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
  summary: "Strong backend focus",
  language: "en",
};

const SKILL_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440061",
  group_id: "550e8400-e29b-41d4-a716-446655440071",
  name: "TypeScript",
  category: "languages",
  sort_order: 0,
};

const SKILL_GROUP_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440071",
  name: "languages",
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
    highlightedItems: [],
    language: "en",
    skillGroups: [{ name: "languages", sortOrder: 0 }],
    skills: [{ name: "TypeScript", category: "languages", sortOrder: 0 }],
    assignments: [],
  },
  message: "My version",
  title: "My version",
  description: "",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  headCommitRow?: unknown;
  skillGroupRows?: unknown[];
  skillRows?: unknown[];
  assignmentRows?: unknown[];
  insertedCommit?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    headCommitRow = { content: INSERTED_COMMIT.content },
    skillGroupRows = [SKILL_GROUP_ROW],
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

  // Head commit lookup
  const headCommitExecuteTakeFirst = vi.fn().mockResolvedValue(headCommitRow);
  const headCommitWhere = vi.fn().mockReturnValue({ executeTakeFirst: headCommitExecuteTakeFirst });
  const headCommitSelect = vi.fn().mockReturnValue({ where: headCommitWhere });

  // Skill groups query
  const skillGroupsExecute = vi.fn().mockResolvedValue(skillGroupRows);
  const skillGroupsOrderBy = vi.fn().mockReturnValue({ execute: skillGroupsExecute });
  const skillGroupsWhere = vi.fn().mockReturnValue({ orderBy: skillGroupsOrderBy });
  const skillGroupsSelect = vi.fn().mockReturnValue({ where: skillGroupsWhere });

  // Skills query
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy2 = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsOrderBy1 = vi.fn().mockReturnValue({ orderBy: skillsOrderBy2 });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy1 });
  const skillsSelect = vi.fn().mockReturnValue({ where: skillsWhere });
  const skillsInnerJoin = vi.fn().mockReturnValue({ select: skillsSelect });

  // Assignments query — joins assignments table for soft-delete filter (two where calls)
  const assignmentsExecute = vi.fn().mockResolvedValue(assignmentRows);
  const assignmentsOrderBy = vi.fn().mockReturnValue({ execute: assignmentsExecute });
  const assignmentsWhere2 = vi.fn().mockReturnValue({ orderBy: assignmentsOrderBy });
  const assignmentsWhere1 = vi.fn().mockReturnValue({ where: assignmentsWhere2 });
  const assignmentsSelect = vi.fn().mockReturnValue({ where: assignmentsWhere1 });
  const assignmentsInnerJoin = vi.fn().mockReturnValue({ select: assignmentsSelect });

  // Insert resume_commits
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedCommit);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });

  // Insert resume_commit_parents
  const parentInsertExecute = vi.fn().mockResolvedValue(undefined);
  const parentInsertValues = vi.fn().mockReturnValue({ execute: parentInsertExecute });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_commits") return { values: insertValues };
    if (table === "resume_commit_parents") return { values: parentInsertValues };
    return { values: insertValues };
  });

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
    if (table === "resume_commits") return { select: headCommitSelect };
    if (table === "resume_skill_groups") return { select: skillGroupsSelect };
    if (table === "resume_skills as rs") return { innerJoin: skillsInnerJoin };
    if (table === "branch_assignments as ba") return { innerJoin: assignmentsInnerJoin };
    // resume_branches join
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, insertValues, parentInsertValues, updateSet, branchWhere };
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

    expect(content.skillGroups).toEqual([{ name: "languages", sortOrder: 0 }]);
    expect(content.skills).toHaveLength(1);
    expect(content.skills[0]).toMatchObject({ name: "TypeScript", category: "languages" });
    expect(content.assignments).toHaveLength(1);
    expect(content.assignments[0]).toMatchObject({
      assignmentId: ASSIGNMENT_ID,
      clientName: "ACME Corp",
      highlight: true,
    });
  });

  it("sets parent_commit_id to the current HEAD of the branch", async () => {
    const branchWithHead = { ...BRANCH_ROW, head_commit_id: "prev-commit-id" };
    const { db, parentInsertValues } = buildDbMock({ branchRow: branchWithHead });

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(parentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        commit_id: COMMIT_ID,
        parent_commit_id: "prev-commit-id",
        parent_order: 0,
      })
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

  it("uses content overrides when provided, ignoring live resume fields", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      consultantTitle: "Principal Engineer",
      presentation: ["Overridden paragraph"],
      summary: "Overridden summary",
    });

    const callArg = insertValues.mock.calls[0][0];
    const content = JSON.parse(callArg.content);

    expect(content.consultantTitle).toBe("Principal Engineer");
    expect(content.presentation).toEqual(["Overridden paragraph"]);
    expect(content.summary).toBe("Overridden summary");
    // Non-overridden fields still come from live resume
    expect(content.title).toBe("Senior Engineer");
    expect(content.language).toBe("en");
  });

  it("uses skills overrides when provided", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      skills: [
        { name: "Team leadership", category: "Management", sortOrder: 0 },
        { name: "Stakeholder management", category: "Management", sortOrder: 1 },
      ],
    });

    const content = JSON.parse(insertValues.mock.calls[0][0].content);
    expect(content.skills).toEqual([
      { name: "Team leadership", category: "Management", sortOrder: 0 },
      { name: "Stakeholder management", category: "Management", sortOrder: 1 },
    ]);
  });

  it("allows setting consultantTitle to null via override", async () => {
    const { db, insertValues } = buildDbMock({
      headCommitRow: {
        content: {
          ...INSERTED_COMMIT.content,
          consultantTitle: "Old Title",
        },
      },
    });

    await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      consultantTitle: null,
    });

    const content = JSON.parse(insertValues.mock.calls[0][0].content);
    expect(content.consultantTitle).toBeNull();
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
