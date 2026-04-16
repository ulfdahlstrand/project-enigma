import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  rebaseRevisionOntoSource,
  createRebaseRevisionOntoSourceHandler,
} from "./rebase-revision.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const REVISION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const REVISION_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const SOURCE_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const FORK_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440043";
const REVISION_TREE_ID = "550e8400-e29b-41d4-a716-000000000091";
const NEW_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440051";
// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const REVISION_CONTENT = {
  title: "Tech Lead",
  consultantTitle: "Principal Engineer",
  presentation: ["Modified by revision"],
  summary: "Revised summary",
  highlightedItems: [],
  language: "sv",
  education: [],
  skillGroups: [],
  skills: [{ name: "Architecture", category: "Design", sortOrder: 0 }],
  assignments: [],
};

/**
 * A revision branch whose source has advanced: source HEAD !== source_commit_id.
 * This means mergeRevisionIntoSource would fail with CONFLICT.
 */
const REVISION_BRANCH_ROW = {
  id: REVISION_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "2026 rebrand",
  language: "sv",
  is_main: false,
  head_commit_id: REVISION_HEAD_COMMIT_ID,
  forked_from_commit_id: FORK_COMMIT_ID,
  branch_type: "revision",
  source_branch_id: SOURCE_BRANCH_ID,
  // fork point — source has moved past this
  source_commit_id: FORK_COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  employee_id: EMPLOYEE_ID_1,
  // source HEAD is ahead of FORK_COMMIT_ID → stale
  source_head_commit_id: SOURCE_HEAD_COMMIT_ID,
  is_archived: false,
};

const REVISION_HEAD_COMMIT_ROW = {
  id: REVISION_HEAD_COMMIT_ID,
  tree_id: REVISION_TREE_ID,
};

const NEW_COMMIT_ROW = {
  id: NEW_COMMIT_ID,
  resume_id: RESUME_ID,
  tree_id: REVISION_TREE_ID,
  title: "Rebase revision onto source",
  description: "Revision content carried forward onto the latest source version. Merge is now unblocked.",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
};

const UPDATED_BRANCH_ROW = {
  ...REVISION_BRANCH_ROW,
  head_commit_id: NEW_COMMIT_ID,
  source_commit_id: SOURCE_HEAD_COMMIT_ID,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  revisionRow?: unknown;
  revisionCommitTreeId?: string | null;
  employeeId?: string | null;
} = {}) {
  const {
    revisionRow = REVISION_BRANCH_ROW,
    revisionCommitTreeId = REVISION_TREE_ID,
    employeeId = null,
  } = opts;

  const resolvedRevision = revisionRow === null ? undefined : revisionRow;

  // employees
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // revision branch join query (branch + resumes + source branch LEFT JOIN)
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedRevision);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchLeftJoin = vi.fn().mockReturnValue({ select: branchSelect });
  const branchInnerJoin = vi.fn().mockReturnValue({ leftJoin: branchLeftJoin });

  // revision HEAD commit tree lookup
  const revCommitExecuteTakeFirst = vi.fn().mockResolvedValue(
    revisionCommitTreeId !== null ? { tree_id: revisionCommitTreeId } : undefined,
  );
  const revCommitWhere = vi.fn().mockReturnValue({ executeTakeFirst: revCommitExecuteTakeFirst });
  const revCommitSelect = vi.fn().mockReturnValue({ where: revCommitWhere });

  // insert new commit
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(NEW_COMMIT_ROW);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });

  // insert parent edge — two calls: one for source HEAD parent, one for old revision HEAD parent
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

  // update branch with returningAll for final state
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
          return { innerJoin: branchInnerJoin, select: revCommitSelect };
        }),
      };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commits") return { select: revCommitSelect };
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction, updateTable } as unknown as Kysely<Database>;
  return { db, insertValues, parentInsertValues, updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rebaseRevisionOntoSource", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(REVISION_CONTENT as never);
  });

  it("creates a new commit with revision content and source HEAD as parent", async () => {
    const { db, insertValues, parentInsertValues } = buildDbMock();

    await rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ resume_id: RESUME_ID, created_by: MOCK_ADMIN.id }),
    );
    // Parent #0: source HEAD (so the new commit is logically on top of source)
    expect(parentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_commit_id: SOURCE_HEAD_COMMIT_ID,
        parent_order: 0,
      }),
    );
  });

  it("updates source_commit_id to source HEAD so merge is unblocked", async () => {
    const { db, updateSet } = buildDbMock();

    await rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ source_commit_id: SOURCE_HEAD_COMMIT_ID }),
    );
  });

  it("advances revision HEAD to the new commit", async () => {
    const { db, updateSet } = buildDbMock();

    await rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ head_commit_id: NEW_COMMIT_ID }),
    );
  });

  it("returns the updated branch with isStale false", async () => {
    const { db } = buildDbMock();

    const result = await rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID });

    expect(result.sourceCommitId).toBe(SOURCE_HEAD_COMMIT_ID);
    expect(result.headCommitId).toBe(NEW_COMMIT_ID);
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ revisionRow: null });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch is not a revision", async () => {
    const { db } = buildDbMock({
      revisionRow: { ...REVISION_BRANCH_ROW, branch_type: "translation" },
    });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when source has no HEAD commit", async () => {
    const { db } = buildDbMock({
      revisionRow: { ...REVISION_BRANCH_ROW, source_head_commit_id: null },
    });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when source is not ahead (nothing to rebase)", async () => {
    // source_commit_id === source_head_commit_id → already up to date
    const { db } = buildDbMock({
      revisionRow: {
        ...REVISION_BRANCH_ROW,
        source_commit_id: SOURCE_HEAD_COMMIT_ID,
        source_head_commit_id: SOURCE_HEAD_COMMIT_ID,
      },
    });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when revision has no head commit", async () => {
    const { db } = buildDbMock({
      revisionRow: { ...REVISION_BRANCH_ROW, head_commit_id: null },
    });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_ADMIN, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant tries to rebase another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_CONSULTANT_2, { branchId: REVISION_BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("consultant can rebase their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      rebaseRevisionOntoSource(db, MOCK_CONSULTANT, { branchId: REVISION_BRANCH_ID }),
    ).resolves.toBeDefined();
  });
});

describe("createRebaseRevisionOntoSourceHandler", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(REVISION_CONTENT as never);
  });

  it("calls rebaseRevisionOntoSource with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createRebaseRevisionOntoSourceHandler(db);

    const result = await call(
      handler,
      { branchId: REVISION_BRANCH_ID },
      { context: { user: MOCK_ADMIN } },
    );

    expect(result.id).toBe(REVISION_BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createRebaseRevisionOntoSourceHandler(db);

    await expect(
      call(handler, { branchId: REVISION_BRANCH_ID }, { context: {} }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
