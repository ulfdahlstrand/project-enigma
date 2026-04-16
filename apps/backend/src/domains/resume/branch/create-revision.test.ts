import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createRevisionBranch } from "./create-revision.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const NEW_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const SOURCE_BRANCH_ROW = {
  id: SOURCE_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "Tech Lead",
  language: "sv",
  is_main: false,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: null,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
  employee_id: EMPLOYEE_ID,
};

const CREATED_BRANCH_ROW = {
  id: NEW_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "2026 rebrand",
  language: "sv",
  is_main: false,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: HEAD_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
  branch_type: "revision" as const,
  source_branch_id: SOURCE_BRANCH_ID,
  source_commit_id: HEAD_COMMIT_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  sourceBranchRow?: unknown;
  employeeRow?: unknown;
  createdBranchRow?: unknown;
} = {}) {
  const {
    sourceBranchRow = SOURCE_BRANCH_ROW,
    employeeRow = { id: EMPLOYEE_ID },
    createdBranchRow = CREATED_BRANCH_ROW,
  } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeRow);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const sourceBranchExecuteTakeFirst = vi.fn().mockResolvedValue(sourceBranchRow ?? undefined);
  const sourceBranchWhere = vi.fn().mockReturnValue({ executeTakeFirst: sourceBranchExecuteTakeFirst });
  const sourceBranchSelect = vi.fn().mockReturnValue({ where: sourceBranchWhere });
  const sourceBranchInnerJoin = vi.fn().mockReturnValue({ select: sourceBranchSelect });

  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(createdBranchRow);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_branches as rb") return { innerJoin: sourceBranchInnerJoin };
    return { select: empSelect };
  });

  const db = { selectFrom, insertInto } as unknown as Kysely<Database>;
  return { db, insertValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRevisionBranch", () => {
  it("creates a revision branch with the correct fields", async () => {
    const { db, insertValues } = buildDbMock();

    const result = await createRevisionBranch(db, MOCK_ADMIN, {
      sourceBranchId: SOURCE_BRANCH_ID,
      name: "2026 rebrand",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_type: "revision",
        source_branch_id: SOURCE_BRANCH_ID,
        source_commit_id: HEAD_COMMIT_ID,
        // Revision starts at source HEAD so the user sees a full CV immediately
        head_commit_id: HEAD_COMMIT_ID,
        forked_from_commit_id: HEAD_COMMIT_ID,
        language: "sv",
        name: "2026 rebrand",
      }),
    );

    expect(result).toMatchObject({
      id: NEW_BRANCH_ID,
      branchType: "revision",
      sourceBranchId: SOURCE_BRANCH_ID,
      sourceCommitId: HEAD_COMMIT_ID,
      headCommitId: HEAD_COMMIT_ID,
      isStale: false,
        isArchived: false,
    });
  });

  it("inherits language from the source variant", async () => {
    const { db, insertValues } = buildDbMock();

    await createRevisionBranch(db, MOCK_ADMIN, {
      sourceBranchId: SOURCE_BRANCH_ID,
      name: "my revision",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ language: "sv" }),
    );
  });

  it("throws NOT_FOUND when source branch does not exist", async () => {
    const { db } = buildDbMock({ sourceBranchRow: null });

    await expect(
      createRevisionBranch(db, MOCK_ADMIN, { sourceBranchId: SOURCE_BRANCH_ID, name: "r" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when source branch is not a variant", async () => {
    const { db } = buildDbMock({
      sourceBranchRow: { ...SOURCE_BRANCH_ROW, branch_type: "translation" },
    });

    await expect(
      createRevisionBranch(db, MOCK_ADMIN, { sourceBranchId: SOURCE_BRANCH_ID, name: "r" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_2 } });

    await expect(
      createRevisionBranch(db, MOCK_CONSULTANT_2, { sourceBranchId: SOURCE_BRANCH_ID, name: "r" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("allows consultant to create revision on their own resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID } });

    await expect(
      createRevisionBranch(db, MOCK_CONSULTANT, { sourceBranchId: SOURCE_BRANCH_ID, name: "r" }),
    ).resolves.toBeDefined();
  });
});
