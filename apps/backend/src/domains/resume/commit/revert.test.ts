import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { revertCommit, createRevertCommitHandler } from "./revert.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const TARGET_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const NEW_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440043";
const TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const TARGET_CONTENT = {
  title: "Senior Engineer",
  consultantTitle: "Tech Lead",
  presentation: ["Experienced backend engineer"],
  summary: "Strong TypeScript background",
  highlightedItems: [],
  language: "sv",
  education: [],
  skillGroups: [],
  skills: [{ name: "TypeScript", category: "Languages", sortOrder: 0 }],
  assignments: [],
};

const BRANCH_ROW = {
  id: BRANCH_ID,
  resume_id: RESUME_ID,
  head_commit_id: HEAD_COMMIT_ID,
  forked_from_commit_id: null,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Engineer",
  language: "sv",
};

// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const NEW_COMMIT_ROW = {
  id: NEW_COMMIT_ID,
  resume_id: RESUME_ID,
  tree_id: TREE_ID,
  title: `Revert to earlier version`,
  description: "Reverted branch to an earlier commit snapshot.",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  reachableCommitIds?: string[];
  employeeId?: string | null;
  targetCommitTreeId?: string;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    reachableCommitIds = [HEAD_COMMIT_ID, TARGET_COMMIT_ID],
    employeeId = null,
    targetCommitTreeId = TREE_ID,
  } = opts;

  const resolvedBranch = branchRow === null ? undefined : branchRow;

  // employees
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // resume_branches join
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  // resume_commit_parents — for reachability walk
  const parentRows = reachableCommitIds.slice(1).map((id, i) => ({
    commit_id: reachableCommitIds[i],
    parent_commit_id: id,
    parent_order: 0,
  }));
  const parentsExecute = vi.fn().mockResolvedValue(parentRows);
  const parentsOrderBy = vi.fn().mockReturnValue({ execute: parentsExecute });
  const parentsSelect = vi.fn().mockReturnValue({ orderBy: parentsOrderBy });

  // target commit tree lookup
  const targetCommitExecuteTakeFirst = vi.fn().mockResolvedValue(
    targetCommitTreeId ? { tree_id: targetCommitTreeId } : undefined,
  );
  const targetCommitWhere = vi.fn().mockReturnValue({ executeTakeFirst: targetCommitExecuteTakeFirst });
  const targetCommitSelect = vi.fn().mockReturnValue({ where: targetCommitWhere });

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

  // update branch HEAD
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
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
          return { innerJoin: branchInnerJoin, select: targetCommitSelect };
        }),
      };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commit_parents as rcp") return { select: parentsSelect };
    if (table === "resume_commits") return { select: targetCommitSelect };
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction, updateTable } as unknown as Kysely<Database>;
  return { db, insertValues, parentInsertValues, updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("revertCommit", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(TARGET_CONTENT as never);
  });

  it("creates a new commit with the target commit's content and advances HEAD", async () => {
    const { db, insertValues, updateSet } = buildDbMock();

    await revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        created_by: MOCK_ADMIN.id,
      }),
    );
    expect(updateSet).toHaveBeenCalledWith({ head_commit_id: NEW_COMMIT_ID });
  });

  it("uses provided title when given", async () => {
    const { db, insertValues } = buildDbMock();

    await revertCommit(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      targetCommitId: TARGET_COMMIT_ID,
      title: "Restore to March version",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Restore to March version" }),
    );
  });

  it("generates a default title when none provided", async () => {
    const { db, insertValues } = buildDbMock();

    await revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Revert") }),
    );
  });

  it("sets parent_commit_id to the current HEAD", async () => {
    const { db, parentInsertValues } = buildDbMock();

    await revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID });

    expect(parentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_commit_id: HEAD_COMMIT_ID,
        parent_order: 0,
      }),
    );
  });

  it("returns the new commit with the target content", async () => {
    const { db } = buildDbMock();

    const result = await revertCommit(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      targetCommitId: TARGET_COMMIT_ID,
    });

    expect(result.content.skills).toEqual(TARGET_CONTENT.skills);
    expect(result.content.consultantTitle).toBe("Tech Lead");
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when branch has no commits", async () => {
    const { db } = buildDbMock({
      branchRow: { ...BRANCH_ROW, head_commit_id: null },
    });

    await expect(
      revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws BAD_REQUEST when target commit is not reachable from HEAD", async () => {
    const UNREACHABLE_ID = "550e8400-e29b-41d4-a716-000000000099";
    const { db } = buildDbMock({ reachableCommitIds: [HEAD_COMMIT_ID] });

    await expect(
      revertCommit(db, MOCK_ADMIN, { branchId: BRANCH_ID, targetCommitId: UNREACHABLE_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("throws FORBIDDEN when consultant tries to revert another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      revertCommit(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("consultant can revert their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      revertCommit(db, MOCK_CONSULTANT, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID }),
    ).resolves.toBeDefined();
  });
});

describe("createRevertCommitHandler", () => {
  it("calls revertCommit with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createRevertCommitHandler(db);

    const result = await call(
      handler,
      { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID },
      { context: { user: MOCK_ADMIN } },
    );

    expect(result.id).toBe(NEW_COMMIT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createRevertCommitHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID, targetCommitId: TARGET_COMMIT_ID }, { context: {} }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
