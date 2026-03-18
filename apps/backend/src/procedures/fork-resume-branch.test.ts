import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { forkResumeBranch, createForkResumeBranchHandler } from "./fork-resume-branch.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const NEW_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const COMMIT_ROW = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  source_branch_id: SOURCE_BRANCH_ID,
  employee_id: EMPLOYEE_ID_1,
};

const NEW_BRANCH_ROW = {
  id: NEW_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "Swedish Variant",
  language: "en",
  is_main: false,
  head_commit_id: COMMIT_ID,
  forked_from_commit_id: COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

const SOURCE_ASSIGNMENTS = [
  { assignment_id: "550e8400-e29b-41d4-a716-446655440051", highlight: true, sort_order: 0 },
];

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  commitRow?: unknown;
  newBranchRow?: unknown;
  sourceAssignments?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    commitRow = COMMIT_ROW,
    newBranchRow = NEW_BRANCH_ROW,
    sourceAssignments = SOURCE_ASSIGNMENTS,
    employeeId = null,
  } = opts;

  const resolvedCommit = commitRow === null ? undefined : commitRow;

  // Employee lookup (for consultant auth)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Commit + resume join query
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedCommit);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitInnerJoin = vi.fn().mockReturnValue({ select: commitSelect });

  // Branch insert (inside transaction)
  const branchInsertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(newBranchRow);
  const branchInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: branchInsertExecuteTakeFirstOrThrow });
  const branchInsertValues = vi.fn().mockReturnValue({ returningAll: branchInsertReturningAll });

  // Source assignments query (inside transaction)
  const assignmentsExecute = vi.fn().mockResolvedValue(sourceAssignments);
  const assignmentsWhere = vi.fn().mockReturnValue({ execute: assignmentsExecute });
  const assignmentsSelect = vi.fn().mockReturnValue({ where: assignmentsWhere });

  // Copy assignments insert (inside transaction)
  const copyInsertExecute = vi.fn().mockResolvedValue(undefined);
  const copyInsertValues = vi.fn().mockReturnValue({ execute: copyInsertExecute });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_branches") return { values: branchInsertValues };
    if (table === "branch_assignments") return { values: copyInsertValues };
    return {};
  });

  const trxSelectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "branch_assignments") return { select: assignmentsSelect };
    return {};
  });

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { insertInto, selectFrom: trxSelectFrom };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    // commit + resume join
    return { innerJoin: commitInnerJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, branchInsertValues, copyInsertValues, commitWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("forkResumeBranch", () => {
  it("creates a new branch forked from the given commit", async () => {
    const { db, branchInsertValues } = buildDbMock();

    const result = await forkResumeBranch(db, MOCK_ADMIN, {
      fromCommitId: COMMIT_ID,
      name: "Swedish Variant",
    });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        name: "Swedish Variant",
        head_commit_id: COMMIT_ID,
        forked_from_commit_id: COMMIT_ID,
        is_main: false,
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(result.id).toBe(NEW_BRANCH_ID);
    expect(result.headCommitId).toBe(COMMIT_ID);
    expect(result.forkedFromCommitId).toBe(COMMIT_ID);
    expect(result.isMain).toBe(false);
  });

  it("copies branch_assignments from the source branch to the new branch", async () => {
    const { db, copyInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(copyInsertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          branch_id: NEW_BRANCH_ID,
          assignment_id: SOURCE_ASSIGNMENTS[0].assignment_id,
          highlight: true,
          sort_order: 0,
        }),
      ])
    );
  });

  it("skips copying assignments if source branch has none", async () => {
    const { db, copyInsertValues } = buildDbMock({ sourceAssignments: [] });

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(copyInsertValues).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when commit does not exist", async () => {
    const { db } = buildDbMock({ commitRow: null });

    await expect(
      forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fork their own resume's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      forkResumeBranch(db, MOCK_CONSULTANT, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant tries to fork another employee's resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      forkResumeBranch(db, MOCK_CONSULTANT_2, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createForkResumeBranchHandler", () => {
  it("calls forkResumeBranch with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createForkResumeBranchHandler(db);

    const result = await call(
      handler,
      { fromCommitId: COMMIT_ID, name: "Swedish Variant" },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(NEW_BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createForkResumeBranchHandler(db);

    await expect(
      call(handler, { fromCommitId: COMMIT_ID, name: "Fork" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
