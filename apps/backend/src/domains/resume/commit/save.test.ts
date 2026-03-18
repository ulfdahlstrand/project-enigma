import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { saveResumeVersion, createSaveResumeVersionHandler } from "./save.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";
// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const BRANCH_ROW = {
  id: BRANCH_ID,
  resume_id: RESUME_ID,
  head_commit_id: null,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Engineer",
  consultant_title: null,
  presentation: ["Experienced engineer"],
  summary: "Strong backend focus",
  language: "en",
};

const SKILL_ROW = {
  name: "TypeScript",
  level: "expert",
  category: "languages",
  sort_order: 0,
};

const ASSIGNMENT_ROW = {
  assignment_id: ASSIGNMENT_ID,
  client_name: "ACME Corp",
  role: "Backend Engineer",
  description: "Built APIs",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["Node.js", "PostgreSQL"],
  is_current: true,
  keywords: null,
  type: null,
  highlight: true,
  sort_order: 0,
};

const INSERTED_COMMIT = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  branch_id: BRANCH_ID,
  parent_commit_id: null,
  content: {
    title: "Senior Engineer",
    consultantTitle: null,
    presentation: ["Experienced engineer"],
    summary: "Strong backend focus",
    language: "en",
    skills: [{ name: "TypeScript", level: "expert", category: "languages", sortOrder: 0 }],
    assignments: [],
  },
  message: "My version",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  skillRows?: unknown[];
  assignmentRows?: unknown[];
  insertedCommit?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    skillRows = [SKILL_ROW],
    assignmentRows = [ASSIGNMENT_ROW],
    insertedCommit = INSERTED_COMMIT,
    employeeId = null,
  } = opts;
  // null sentinel → Kysely "not found" (executeTakeFirst returns undefined)
  const resolvedBranch = branchRow === null ? undefined : branchRow;
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Branch + resume join query
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  // Skills query
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelect = vi.fn().mockReturnValue({ where: skillsWhere });

  // Assignments join query
  const assignmentsExecute = vi.fn().mockResolvedValue(assignmentRows);
  const assignmentsOrderBy = vi.fn().mockReturnValue({ execute: assignmentsExecute });
  const assignmentsWhere = vi.fn().mockReturnValue({ orderBy: assignmentsOrderBy });
  const assignmentsSelect = vi.fn().mockReturnValue({ where: assignmentsWhere });
  const assignmentsInnerJoin = vi.fn().mockReturnValue({ select: assignmentsSelect });

  // Insert commit
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedCommit);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  // Update branch
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  // Transaction
  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { insertInto, updateTable };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_skills") return { select: skillsSelect };
    if (table === "branch_assignments as ba") return { innerJoin: assignmentsInnerJoin };
    // resume_branches join
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, insertValues, updateSet, branchWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveResumeVersion", () => {
  it("creates a commit with the current resume state and advances HEAD", async () => {
    const { db, insertValues, updateSet } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID, message: "My version" });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        branch_id: BRANCH_ID,
        parent_commit_id: null,
        message: "My version",
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(updateSet).toHaveBeenCalledWith({ head_commit_id: COMMIT_ID });
  });

  it("uses empty string message when no message provided", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ message: "" })
    );
  });

  it("snapshot content includes skills and assignments", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    const callArg = insertValues.mock.calls[0][0];
    const content = JSON.parse(callArg.content);

    expect(content.skills).toHaveLength(1);
    expect(content.skills[0]).toMatchObject({ name: "TypeScript", level: "expert" });
    expect(content.assignments).toHaveLength(1);
    expect(content.assignments[0]).toMatchObject({
      assignmentId: ASSIGNMENT_ID,
      clientName: "ACME Corp",
      highlight: true,
    });
  });

  it("sets parent_commit_id to the current HEAD of the branch", async () => {
    const branchWithHead = { ...BRANCH_ROW, head_commit_id: "prev-commit-id" };
    const { db, insertValues } = buildDbMock({ branchRow: branchWithHead });

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ parent_commit_id: "prev-commit-id" })
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can save their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      saveResumeVersion(db, MOCK_CONSULTANT, { branchId: BRANCH_ID })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant tries to save another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      saveResumeVersion(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createSaveResumeVersionHandler", () => {
  it("calls saveResumeVersion with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createSaveResumeVersionHandler(db);

    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });

    expect(result.id).toBe(COMMIT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createSaveResumeVersionHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
