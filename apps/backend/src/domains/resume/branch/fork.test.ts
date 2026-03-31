import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { forkResumeBranch, createForkResumeBranchHandler } from "./fork.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const NEW_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const INITIAL_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const COMMIT_CONTENT = {
  title: "My Resume",
  consultantTitle: "Senior Developer",
  presentation: ["Para 1"],
  summary: "Summary text",
  language: "sv",
  skills: [],
  assignments: [],
};

const COMMIT_ROW = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  source_branch_id: SOURCE_BRANCH_ID,
  employee_id: EMPLOYEE_ID_1,
  source_language: "sv",
  content: COMMIT_CONTENT,
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

const INITIAL_COMMIT_ROW = {
  id: INITIAL_COMMIT_ID,
  resume_id: RESUME_ID,
  branch_id: NEW_BRANCH_ID,
  parent_commit_id: COMMIT_ID,
  content: COMMIT_CONTENT,
  message: "",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

const SOURCE_ASSIGNMENTS = [
  { assignment_id: "550e8400-e29b-41d4-a716-446655440051", highlight: true, sort_order: 0 },
];

const FRESH_ASSIGNMENT_ROWS = [
  {
    assignment_id: "550e8400-e29b-41d4-a716-446655440051",
    client_name: "Acme Corp",
    role: "Developer",
    description: "Built things",
    start_date: new Date("2023-01-01"),
    end_date: null,
    technologies: ["TypeScript"],
    is_current: true,
    keywords: null,
    type: null,
    highlight: true,
    sort_order: 0,
  },
];

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  commitRow?: unknown;
  newBranchRow?: unknown;
  initialCommitRow?: unknown;
  sourceAssignments?: unknown[];
  freshAssignmentRows?: unknown[];
  highlightedItemRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    commitRow = COMMIT_ROW,
    newBranchRow = NEW_BRANCH_ROW,
    initialCommitRow = INITIAL_COMMIT_ROW,
    sourceAssignments = SOURCE_ASSIGNMENTS,
    freshAssignmentRows = FRESH_ASSIGNMENT_ROWS,
    highlightedItemRows = [],
    employeeId = null,
  } = opts;

  const resolvedCommit = commitRow === null ? undefined : commitRow;

  // Employee lookup (for consultant auth)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Commit + resume join + source branch leftJoin (for language)
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedCommit);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitLeftJoin = vi.fn().mockReturnValue({ select: commitSelect });
  const commitInnerJoin = vi.fn().mockReturnValue({ leftJoin: commitLeftJoin });

  // Branch insert (inside transaction)
  const branchInsertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(newBranchRow);
  const branchInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: branchInsertExecuteTakeFirstOrThrow });
  const branchInsertValues = vi.fn().mockReturnValue({ returningAll: branchInsertReturningAll });

  // Source assignments query — branch_assignments as ba, innerJoin + selectAll + 2 wheres (copy step)
  const assignmentsExecute = vi.fn().mockResolvedValue(sourceAssignments);
  const assignmentsWhere2 = vi.fn().mockReturnValue({ execute: assignmentsExecute });
  const assignmentsWhere1 = vi.fn().mockReturnValue({ where: assignmentsWhere2 });
  const assignmentsSelectAll = vi.fn().mockReturnValue({ where: assignmentsWhere1 });
  const assignmentsInnerJoin = vi.fn().mockReturnValue({ selectAll: assignmentsSelectAll });

  // Fresh assignments query — branch_assignments as ba, select([...]) (content build step)
  const freshAssignmentsExecute = vi.fn().mockResolvedValue(freshAssignmentRows);
  const freshAssignmentsOrderBy = vi.fn().mockReturnValue({ execute: freshAssignmentsExecute });
  const freshAssignmentsWhere = vi.fn().mockReturnValue({ orderBy: freshAssignmentsOrderBy });
  const freshAssignmentsSelect = vi.fn().mockReturnValue({ where: freshAssignmentsWhere });

  // Highlighted items query — resume_highlighted_items, select(["text"]).where().orderBy().execute()
  const highlightedItemsExecute = vi.fn().mockResolvedValue(highlightedItemRows);
  const highlightedItemsOrderBy = vi.fn().mockReturnValue({ execute: highlightedItemsExecute });
  const highlightedItemsWhere = vi.fn().mockReturnValue({ orderBy: highlightedItemsOrderBy });
  const highlightedItemsSelect = vi.fn().mockReturnValue({ where: highlightedItemsWhere });

  // Copy assignments insert (inside transaction)
  const copyInsertExecute = vi.fn().mockResolvedValue(undefined);
  const copyInsertValues = vi.fn().mockReturnValue({ execute: copyInsertExecute });

  // Initial commit insert (inside transaction)
  const commitInsertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(initialCommitRow);
  const commitInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: commitInsertExecuteTakeFirstOrThrow });
  const commitInsertValues = vi.fn().mockReturnValue({ returningAll: commitInsertReturningAll });

  // Parent commit insert (resume_commit_parents)
  const parentCommitInsertExecute = vi.fn().mockResolvedValue(undefined);
  const parentCommitInsertValues = vi.fn().mockReturnValue({ execute: parentCommitInsertExecute });

  // updateTable for advancing head_commit_id (inside transaction)
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_branches") return { values: branchInsertValues };
    if (table === "branch_assignments") return { values: copyInsertValues };
    if (table === "resume_commits") return { values: commitInsertValues };
    if (table === "resume_commit_parents") return { values: parentCommitInsertValues };
    return {};
  });

  const trxSelectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "branch_assignments as ba") return {
      // Source copy path starts with innerJoin; fresh content path starts with select
      innerJoin: assignmentsInnerJoin,
      select: freshAssignmentsSelect,
    };
    if (table === "resume_highlighted_items") return { select: highlightedItemsSelect };
    return {};
  });

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { insertInto, selectFrom: trxSelectFrom, updateTable };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    // commit + resume join
    return { innerJoin: commitInnerJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, branchInsertValues, copyInsertValues, commitInsertValues, parentCommitInsertValues, updateSet, commitWhere };
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
        forked_from_commit_id: COMMIT_ID,
        is_main: false,
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(result.id).toBe(NEW_BRANCH_ID);
    // headCommitId points to the initial commit, not the forked commit
    expect(result.headCommitId).toBe(INITIAL_COMMIT_ID);
    expect(result.forkedFromCommitId).toBe(COMMIT_ID);
    expect(result.isMain).toBe(false);
  });

  it("creates an initial commit on the new branch with parent_commit_id = fromCommitId", async () => {
    const { db, commitInsertValues, parentCommitInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(commitInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        branch_id: NEW_BRANCH_ID,
        message: "Create revision branch: Fork",
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(parentCommitInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        commit_id: INITIAL_COMMIT_ID,
        parent_commit_id: COMMIT_ID,
        parent_order: 0,
      })
    );
  });

  it("builds initial commit content from fresh branch_assignments (not stale JSONB)", async () => {
    const { db, commitInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    const call = commitInsertValues.mock.calls[0][0] as { content: string };
    const content = JSON.parse(call.content) as { assignments: { assignmentId: string; clientName: string }[] };
    expect(content.assignments).toHaveLength(1);
    expect(content.assignments[0].assignmentId).toBe(FRESH_ASSIGNMENT_ROWS[0].assignment_id);
    expect(content.assignments[0].clientName).toBe(FRESH_ASSIGNMENT_ROWS[0].client_name);
  });

  it("initial commit content preserves scalar fields from the source commit", async () => {
    const { db, commitInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    const call = commitInsertValues.mock.calls[0][0] as { content: string };
    const content = JSON.parse(call.content) as { title: string; summary: string };
    expect(content.title).toBe(COMMIT_CONTENT.title);
    expect(content.summary).toBe(COMMIT_CONTENT.summary);
  });

  it("advances branch head_commit_id to the initial commit", async () => {
    const { db, updateSet } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(updateSet).toHaveBeenCalledWith({ head_commit_id: INITIAL_COMMIT_ID });
  });

  it("inherits language from the source branch", async () => {
    const { db, branchInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ language: "sv" })
    );
  });

  it("falls back to 'en' language when source branch has no language", async () => {
    const commitWithNoLanguage = { ...COMMIT_ROW, source_language: null };
    const { db, branchInsertValues } = buildDbMock({ commitRow: commitWithNoLanguage });

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
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
