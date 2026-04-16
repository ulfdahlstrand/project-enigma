import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  rebaseTranslationOntoSource,
  createRebaseTranslationOntoSourceHandler,
} from "./rebase-translation.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const TRANSLATION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const TRANSLATION_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const SOURCE_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const OLD_SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440043";
const SOURCE_TREE_ID = "550e8400-e29b-41d4-a716-000000000099";
const NEW_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440051";
// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const SOURCE_CONTENT = {
  title: "Tech Lead",
  consultantTitle: "Tech Lead",
  presentation: ["Experienced leader"],
  summary: "Leads complex teams",
  highlightedItems: [],
  language: "sv",
  education: [],
  skillGroups: [],
  skills: [],
  assignments: [],
};

/** A translation branch that is stale (source has advanced). */
const TRANSLATION_BRANCH_ROW = {
  id: TRANSLATION_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "Tech Lead-en",
  language: "en",
  is_main: false,
  head_commit_id: TRANSLATION_HEAD_COMMIT_ID,
  forked_from_commit_id: OLD_SOURCE_COMMIT_ID,
  branch_type: "translation",
  source_branch_id: SOURCE_BRANCH_ID,
  source_commit_id: OLD_SOURCE_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  employee_id: EMPLOYEE_ID_1,
  source_head_commit_id: SOURCE_HEAD_COMMIT_ID,
  is_archived: false,
};

const NEW_COMMIT_ROW = {
  id: NEW_COMMIT_ID,
  resume_id: RESUME_ID,
  tree_id: SOURCE_TREE_ID,
  title: "Rebase translation onto source",
  description: "Replaced translation content with the latest source version. Re-translate the changed sections.",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
};

const UPDATED_BRANCH_ROW = {
  ...TRANSLATION_BRANCH_ROW,
  head_commit_id: NEW_COMMIT_ID,
  source_commit_id: SOURCE_HEAD_COMMIT_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  translationRow?: unknown;
  sourceCommitTreeId?: string | null;
  employeeId?: string | null;
} = {}) {
  const {
    translationRow = TRANSLATION_BRANCH_ROW,
    sourceCommitTreeId = SOURCE_TREE_ID,
    employeeId = null,
  } = opts;

  const resolvedTranslation = translationRow === null ? undefined : translationRow;

  // employees
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // translation branch join query
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedTranslation);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchLeftJoin = vi.fn().mockReturnValue({ select: branchSelect });
  const branchInnerJoin = vi.fn().mockReturnValue({ leftJoin: branchLeftJoin });

  // source commit tree lookup
  const sourceCommitExecuteTakeFirst = vi.fn().mockResolvedValue(
    sourceCommitTreeId !== null ? { tree_id: sourceCommitTreeId } : undefined,
  );
  const sourceCommitWhere = vi.fn().mockReturnValue({ executeTakeFirst: sourceCommitExecuteTakeFirst });
  const sourceCommitSelect = vi.fn().mockReturnValue({ where: sourceCommitWhere });

  // insert new commit
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(NEW_COMMIT_ROW);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });

  // insert parent edge
  const parentInsertExecute = vi.fn().mockResolvedValue(undefined);
  const parentInsertValues = vi.fn().mockReturnValue({ execute: parentInsertExecute });

  // tree insert stubs (for buildCommitTree)
  const treeInsertReturning = vi.fn().mockReturnValue({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000099" }),
  });
  const treeInsertExecute = vi.fn().mockResolvedValue(undefined);
  const treeInsertValues = vi.fn().mockReturnValue({
    returning: treeInsertReturning,
    execute: treeInsertExecute,
  });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_commits") return { values: insertValues };
    if (table === "resume_commit_parents") return { values: parentInsertValues };
    return { values: treeInsertValues };
  });

  // update branch: returningAll for the final branch state
  const updateReturningAll = vi.fn().mockReturnValue({
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(UPDATED_BRANCH_ROW),
  });
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({
    execute: updateExecute,
    returningAll: updateReturningAll,
  });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  // transaction
  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const treeBaseExecute = vi.fn().mockResolvedValue([]);
      const treeBaseOrderBy = vi.fn().mockReturnValue({ execute: treeBaseExecute });
      const treeBaseWhere = vi.fn().mockReturnValue({ orderBy: treeBaseOrderBy });
      const treeBaseSelect = vi.fn().mockReturnValue({ where: treeBaseWhere });
      const treeBaseInnerJoin = vi.fn().mockReturnValue({ select: treeBaseSelect });
      const trx = {
        insertInto,
        updateTable,
        selectFrom: vi.fn().mockImplementation((table: string) => {
          if (table === "resume_tree_entries as rte") return { innerJoin: treeBaseInnerJoin };
          return { innerJoin: branchInnerJoin, select: sourceCommitSelect };
        }),
      };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commits") return { select: sourceCommitSelect };
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction, updateTable } as unknown as Kysely<Database>;
  return { db, insertValues, parentInsertValues, updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rebaseTranslationOntoSource", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(SOURCE_CONTENT as never);
  });

  it("creates a new commit with source HEAD content and updates source_commit_id", async () => {
    const { db, insertValues, updateSet } = buildDbMock();

    await rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        created_by: MOCK_ADMIN.id,
      }),
    );
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ source_commit_id: SOURCE_HEAD_COMMIT_ID }),
    );
  });

  it("uses the source HEAD commit's content (not the translation's)", async () => {
    const { db } = buildDbMock();

    const result = await rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID });

    // Result should be the updated branch
    expect(result.sourceCommitId).toBe(SOURCE_HEAD_COMMIT_ID);
    expect(result.isStale).toBe(false);
  });

  it("advances translation HEAD to the new commit", async () => {
    const { db, updateSet } = buildDbMock();

    await rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ head_commit_id: NEW_COMMIT_ID }),
    );
  });

  it("sets parent_commit_id to the old translation HEAD", async () => {
    const { db, parentInsertValues } = buildDbMock();

    await rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID });

    expect(parentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_commit_id: TRANSLATION_HEAD_COMMIT_ID,
        parent_order: 0,
      }),
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ translationRow: null });

    await expect(
      rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch is not a translation", async () => {
    const { db } = buildDbMock({
      translationRow: { ...TRANSLATION_BRANCH_ROW, branch_type: "revision" },
    });

    await expect(
      rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when source has no HEAD commit", async () => {
    const { db } = buildDbMock({
      translationRow: { ...TRANSLATION_BRANCH_ROW, source_head_commit_id: null },
    });

    await expect(
      rebaseTranslationOntoSource(db, MOCK_ADMIN, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant tries to rebase another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      rebaseTranslationOntoSource(db, MOCK_CONSULTANT_2, { branchId: TRANSLATION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("consultant can rebase their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      rebaseTranslationOntoSource(db, MOCK_CONSULTANT, { branchId: TRANSLATION_BRANCH_ID }),
    ).resolves.toBeDefined();
  });
});

describe("createRebaseTranslationOntoSourceHandler", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(SOURCE_CONTENT as never);
  });

  it("calls rebaseTranslationOntoSource with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createRebaseTranslationOntoSourceHandler(db);

    const result = await call(
      handler,
      { branchId: TRANSLATION_BRANCH_ID },
      { context: { user: MOCK_ADMIN } },
    );

    expect(result.id).toBe(TRANSLATION_BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createRebaseTranslationOntoSourceHandler(db);

    await expect(
      call(handler, { branchId: TRANSLATION_BRANCH_ID }, { context: {} }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
