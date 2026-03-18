import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listResumeBranches, createListResumeBranchesHandler } from "./list.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID_1 = "550e8400-e29b-41d4-a716-446655440031";
const BRANCH_ID_2 = "550e8400-e29b-41d4-a716-446655440032";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const RESUME_ROW = { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 };

const BRANCH_ROW_1 = {
  id: BRANCH_ID_1,
  resume_id: RESUME_ID,
  name: "main",
  language: "en",
  is_main: true,
  head_commit_id: COMMIT_ID,
  forked_from_commit_id: null,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

const BRANCH_ROW_2 = {
  id: BRANCH_ID_2,
  resume_id: RESUME_ID,
  name: "Swedish Variant",
  language: "sv",
  is_main: false,
  head_commit_id: COMMIT_ID,
  forked_from_commit_id: COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  resumeRow?: unknown;
  branchRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    resumeRow = RESUME_ROW,
    branchRows = [BRANCH_ROW_1, BRANCH_ROW_2],
    employeeId = null,
  } = opts;

  const resolvedResume = resumeRow === null ? undefined : resumeRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Resume ownership check
  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });

  // Branch list query
  const branchExecute = vi.fn().mockResolvedValue(branchRows);
  const branchOrderBy = vi.fn().mockReturnValue({ execute: branchExecute });
  const branchWhere = vi.fn().mockReturnValue({ orderBy: branchOrderBy });
  const branchSelectAll = vi.fn().mockReturnValue({ where: branchWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_branches") return { selectAll: branchSelectAll };
    // resumes table
    return { select: resumeSelect };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listResumeBranches", () => {
  it("returns all branches for a resume", async () => {
    const { db } = buildDbMock();

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: BRANCH_ID_1,
      resumeId: RESUME_ID,
      name: "main",
      language: "en",
      isMain: true,
      headCommitId: COMMIT_ID,
      forkedFromCommitId: null,
    });
    expect(result[1]).toMatchObject({
      id: BRANCH_ID_2,
      name: "Swedish Variant",
      isMain: false,
    });
  });

  it("returns empty array when resume has no branches", async () => {
    const { db } = buildDbMock({ branchRows: [] });

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock({ resumeRow: null });

    await expect(
      listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can list branches for their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      listResumeBranches(db, MOCK_CONSULTANT, { resumeId: RESUME_ID })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      listResumeBranches(db, MOCK_CONSULTANT_2, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createListResumeBranchesHandler", () => {
  it("calls listResumeBranches with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeBranchesHandler(db);

    const result = await call(handler, { resumeId: RESUME_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeBranchesHandler(db);

    await expect(
      call(handler, { resumeId: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
