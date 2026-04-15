import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { markTranslationCaughtUp } from "./mark-translation-caught-up.js";
import { MOCK_ADMIN, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const TRANSLATION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const SOURCE_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const OLD_SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const TRANSLATION_BRANCH_ROW = {
  id: TRANSLATION_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "main-en",
  language: "en",
  is_main: false,
  head_commit_id: OLD_SOURCE_COMMIT_ID,
  forked_from_commit_id: OLD_SOURCE_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  branch_type: "translation" as const,
  source_branch_id: SOURCE_BRANCH_ID,
  source_commit_id: OLD_SOURCE_COMMIT_ID,
  employee_id: EMPLOYEE_ID,
  // joined field: source variant's current HEAD
  source_head_commit_id: SOURCE_HEAD_COMMIT_ID,
};

const UPDATED_BRANCH_ROW = {
  ...TRANSLATION_BRANCH_ROW,
  source_commit_id: SOURCE_HEAD_COMMIT_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  translationBranchRow?: unknown;
  updatedBranchRow?: unknown;
  employeeRow?: unknown;
} = {}) {
  const {
    translationBranchRow = TRANSLATION_BRANCH_ROW,
    updatedBranchRow = UPDATED_BRANCH_ROW,
    employeeRow = { id: EMPLOYEE_ID },
  } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeRow);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const translationExecuteTakeFirst = vi.fn().mockResolvedValue(translationBranchRow ?? undefined);
  const translationWhere = vi.fn().mockReturnValue({ executeTakeFirst: translationExecuteTakeFirst });
  const translationSelect = vi.fn().mockReturnValue({ where: translationWhere });
  const translationLeftJoin = vi.fn().mockReturnValue({ select: translationSelect });
  const translationInnerJoin = vi.fn().mockReturnValue({ leftJoin: translationLeftJoin });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: translationInnerJoin };
  });

  const updateExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(updatedBranchRow);
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

describe("markTranslationCaughtUp", () => {
  it("updates source_commit_id to the source variant's current HEAD", async () => {
    const { db, updateSet } = buildDbMock();

    const result = await markTranslationCaughtUp(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ source_commit_id: SOURCE_HEAD_COMMIT_ID }),
    );

    expect(result).toMatchObject({
      id: TRANSLATION_BRANCH_ID,
      branchType: "translation",
      sourceCommitId: SOURCE_HEAD_COMMIT_ID,
      isStale: false,
    });
  });

  it("throws NOT_FOUND when translation branch does not exist", async () => {
    const { db } = buildDbMock({ translationBranchRow: null });

    await expect(
      markTranslationCaughtUp(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch is not a translation", async () => {
    const { db } = buildDbMock({
      translationBranchRow: { ...TRANSLATION_BRANCH_ROW, branch_type: "revision" },
    });

    await expect(
      markTranslationCaughtUp(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when source branch has no HEAD commit", async () => {
    const { db } = buildDbMock({
      translationBranchRow: { ...TRANSLATION_BRANCH_ROW, source_head_commit_id: null },
    });

    await expect(
      markTranslationCaughtUp(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_2 } });

    await expect(
      markTranslationCaughtUp(db, MOCK_CONSULTANT_2, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});
