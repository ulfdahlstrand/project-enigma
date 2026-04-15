import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { promoteRevisionToVariant } from "./promote-revision.js";
import { MOCK_ADMIN, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const REVISION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const REVISION_BRANCH_ROW = {
  id: REVISION_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "2026 rebrand",
  language: "sv",
  is_main: false,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: SOURCE_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  branch_type: "revision" as const,
  source_branch_id: "550e8400-e29b-41d4-a716-446655440031",
  source_commit_id: SOURCE_COMMIT_ID,
  employee_id: EMPLOYEE_ID,
};

const PROMOTED_BRANCH_ROW = {
  ...REVISION_BRANCH_ROW,
  name: "Startup Focus",
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  revisionBranchRow?: unknown;
  promotedBranchRow?: unknown;
  employeeRow?: unknown;
} = {}) {
  const {
    revisionBranchRow = REVISION_BRANCH_ROW,
    promotedBranchRow = PROMOTED_BRANCH_ROW,
    employeeRow = { id: EMPLOYEE_ID },
  } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeRow);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const revisionExecuteTakeFirst = vi.fn().mockResolvedValue(revisionBranchRow ?? undefined);
  const revisionWhere = vi.fn().mockReturnValue({ executeTakeFirst: revisionExecuteTakeFirst });
  const revisionSelect = vi.fn().mockReturnValue({ where: revisionWhere });
  const revisionInnerJoin = vi.fn().mockReturnValue({ select: revisionSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: revisionInnerJoin };
  });

  const updateExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(promotedBranchRow);
  const updateReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: updateExecuteTakeFirstOrThrow });
  const updateWhere = vi.fn().mockReturnValue({ returningAll: updateReturningAll });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const db = { selectFrom, updateTable } as unknown as Kysely<Database>;
  return { db, updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("promoteRevisionToVariant", () => {
  it("promotes a revision to a standalone variant", async () => {
    const { db, updateSet } = buildDbMock();

    const result = await promoteRevisionToVariant(db, MOCK_ADMIN, {
      branchId: REVISION_BRANCH_ID,
      name: "Startup Focus",
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_type: "variant",
        source_branch_id: null,
        source_commit_id: null,
        name: "Startup Focus",
      }),
    );

    expect(result).toMatchObject({
      id: REVISION_BRANCH_ID,
      branchType: "variant",
      sourceBranchId: null,
      sourceCommitId: null,
      name: "Startup Focus",
      isStale: false,
    });
  });

  it("throws NOT_FOUND when revision branch does not exist", async () => {
    const { db } = buildDbMock({ revisionBranchRow: null });

    await expect(
      promoteRevisionToVariant(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID, name: "New" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch is not a revision", async () => {
    const { db } = buildDbMock({
      revisionBranchRow: { ...REVISION_BRANCH_ROW, branch_type: "translation" },
    });

    await expect(
      promoteRevisionToVariant(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID, name: "New" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_2 } });

    await expect(
      promoteRevisionToVariant(db, MOCK_CONSULTANT_2, { branchId: REVISION_BRANCH_ID, name: "New" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});
