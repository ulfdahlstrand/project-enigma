import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { mergeRevisionIntoSource } from "./merge-revision.js";
import { MOCK_ADMIN, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const REVISION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const REVISION_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";

// The revision branch row (joined with resume for employee_id)
const REVISION_BRANCH_ROW = {
  id: REVISION_BRANCH_ID,
  resume_id: RESUME_ID,
  branch_type: "revision" as const,
  source_branch_id: SOURCE_BRANCH_ID,
  source_commit_id: SOURCE_COMMIT_ID,
  head_commit_id: REVISION_HEAD_COMMIT_ID,
  employee_id: EMPLOYEE_ID,
};

// The source variant branch row
const SOURCE_BRANCH_ROW = {
  id: SOURCE_BRANCH_ID,
  resume_id: RESUME_ID,
  head_commit_id: SOURCE_COMMIT_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  revisionBranchRow?: unknown;
  sourceBranchRow?: unknown;
  employeeRow?: unknown;
} = {}) {
  const {
    revisionBranchRow = REVISION_BRANCH_ROW,
    sourceBranchRow = SOURCE_BRANCH_ROW,
    employeeRow = { id: EMPLOYEE_ID },
  } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeRow);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // First selectFrom call: revision branch (joined with resumes)
  const revisionExecuteTakeFirst = vi.fn().mockResolvedValue(revisionBranchRow ?? undefined);
  const revisionWhere = vi.fn().mockReturnValue({ executeTakeFirst: revisionExecuteTakeFirst });
  const revisionSelect = vi.fn().mockReturnValue({ where: revisionWhere });
  const revisionInnerJoin = vi.fn().mockReturnValue({ select: revisionSelect });

  // Second selectFrom call: source branch
  const sourceExecuteTakeFirst = vi.fn().mockResolvedValue(sourceBranchRow ?? undefined);
  const sourceWhere = vi.fn().mockReturnValue({ executeTakeFirst: sourceExecuteTakeFirst });
  const sourceSelectAll = vi.fn().mockReturnValue({ where: sourceWhere });

  let resumeBranchCallCount = 0;
  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_branches as rb") return { innerJoin: revisionInnerJoin };
    if (table === "resume_branches") {
      resumeBranchCallCount++;
      if (resumeBranchCallCount === 1) return { selectAll: sourceSelectAll };
    }
    return { select: empSelect };
  });

  // UPDATE source branch head_commit_id
  const updateExecute = vi.fn().mockResolvedValue({ numUpdatedRows: 1n });
  const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: updateExecute }) });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  // DELETE revision branch
  const deleteExecute = vi.fn().mockResolvedValue({ numDeletedRows: 1n });
  const deleteWhere = vi.fn().mockReturnValue({ execute: deleteExecute });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const db = { selectFrom, updateTable, deleteFrom } as unknown as Kysely<Database>;
  return { db, updateSet, deleteWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergeRevisionIntoSource", () => {
  it("fast-forwards the source variant to the revision's HEAD and deletes the revision", async () => {
    const { db, updateSet, deleteWhere } = buildDbMock();

    const result = await mergeRevisionIntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ head_commit_id: REVISION_HEAD_COMMIT_ID }),
    );
    expect(deleteWhere).toHaveBeenCalled();
    expect(result).toEqual({ mergedIntoBranchId: SOURCE_BRANCH_ID });
  });

  it("throws NOT_FOUND when revision branch does not exist", async () => {
    const { db } = buildDbMock({ revisionBranchRow: null });

    await expect(
      mergeRevisionIntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch is not a revision", async () => {
    const { db } = buildDbMock({
      revisionBranchRow: { ...REVISION_BRANCH_ROW, branch_type: "variant" },
    });

    await expect(
      mergeRevisionIntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws CONFLICT when source has advanced past the fork point", async () => {
    const { db } = buildDbMock({
      sourceBranchRow: { ...SOURCE_BRANCH_ROW, head_commit_id: "different-commit-id" },
    });

    await expect(
      mergeRevisionIntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "CONFLICT",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_2 } });

    await expect(
      mergeRevisionIntoSource(db, MOCK_CONSULTANT_2, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});
