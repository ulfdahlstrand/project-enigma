import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createTranslationBranch } from "./create-translation.js";
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
  name: "main",
  language: "sv",
  is_main: true,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: null,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
  // from join with resumes
  employee_id: EMPLOYEE_ID,
};

const CREATED_BRANCH_ROW = {
  id: NEW_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "main-en",
  language: "en",
  is_main: false,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: HEAD_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
  branch_type: "translation" as const,
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
  const sourceBranchInnerJoin = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ where: sourceBranchWhere }) });

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

describe("createTranslationBranch", () => {
  it("creates a translation branch with the correct fields", async () => {
    const { db, insertValues } = buildDbMock();

    const result = await createTranslationBranch(db, MOCK_ADMIN, {
      sourceBranchId: SOURCE_BRANCH_ID,
      language: "en",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_type: "translation",
        source_branch_id: SOURCE_BRANCH_ID,
        source_commit_id: HEAD_COMMIT_ID,
        head_commit_id: HEAD_COMMIT_ID,
        forked_from_commit_id: HEAD_COMMIT_ID,
        language: "en",
      }),
    );

    expect(result).toMatchObject({
      id: NEW_BRANCH_ID,
      branchType: "translation",
      sourceBranchId: SOURCE_BRANCH_ID,
      sourceCommitId: HEAD_COMMIT_ID,
      language: "en",
      isStale: false,
        isArchived: false,
    });
  });

  it("uses provided name when given", async () => {
    const { db, insertValues } = buildDbMock();

    await createTranslationBranch(db, MOCK_ADMIN, {
      sourceBranchId: SOURCE_BRANCH_ID,
      language: "en",
      name: "main-english",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "main-english" }),
    );
  });

  it("auto-derives name from source name + language when name not provided", async () => {
    const { db, insertValues } = buildDbMock();

    await createTranslationBranch(db, MOCK_ADMIN, {
      sourceBranchId: SOURCE_BRANCH_ID,
      language: "en",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "main-en" }),
    );
  });

  it("throws NOT_FOUND when source branch does not exist", async () => {
    const { db } = buildDbMock({ sourceBranchRow: null });

    await expect(
      createTranslationBranch(db, MOCK_ADMIN, { sourceBranchId: SOURCE_BRANCH_ID, language: "en" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when source branch is not a variant", async () => {
    const { db } = buildDbMock({
      sourceBranchRow: { ...SOURCE_BRANCH_ROW, branch_type: "revision" },
    });

    await expect(
      createTranslationBranch(db, MOCK_ADMIN, { sourceBranchId: SOURCE_BRANCH_ID, language: "en" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when source branch has no HEAD commit", async () => {
    const { db } = buildDbMock({
      sourceBranchRow: { ...SOURCE_BRANCH_ROW, head_commit_id: null },
    });

    await expect(
      createTranslationBranch(db, MOCK_ADMIN, { sourceBranchId: SOURCE_BRANCH_ID, language: "en" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_2 } });

    await expect(
      createTranslationBranch(db, MOCK_CONSULTANT_2, { sourceBranchId: SOURCE_BRANCH_ID, language: "en" }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("allows consultant to create translation on their own resume", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID } });

    await expect(
      createTranslationBranch(db, MOCK_CONSULTANT, { sourceBranchId: SOURCE_BRANCH_ID, language: "en" }),
    ).resolves.toBeDefined();
  });
});
