import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { saveResumeVersion, createSaveResumeVersionHandler } from "./save.js";
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
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";
// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";
const DEFAULT_TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const BRANCH_ROW = {
  id: BRANCH_ID,
  resume_id: RESUME_ID,
  head_commit_id: null,
  forked_from_commit_id: null,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Engineer",
  summary: "Strong backend focus",
  language: "en",
};

const SKILL_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440061",
  group_id: "550e8400-e29b-41d4-a716-446655440071",
  name: "TypeScript",
  category: "languages",
  sort_order: 0,
};

const SKILL_GROUP_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440071",
  name: "languages",
  sort_order: 0,
};

const INSERTED_COMMIT = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  parent_commit_id: null,
  content: {
    title: "Senior Engineer",
    consultantTitle: null,
    presentation: ["Experienced engineer"],
    summary: "Strong backend focus",
    highlightedItems: [],
    language: "en",
    skillGroups: [{ name: "languages", sortOrder: 0 }],
    skills: [{ name: "TypeScript", category: "languages", sortOrder: 0 }],
    assignments: [
      {
        assignmentId: ASSIGNMENT_ID,
        clientName: "ACME Corp",
        role: "Backend Engineer",
        description: "Built APIs",
        startDate: "2023-01-01T00:00:00.000Z",
        endDate: null,
        technologies: ["Node.js", "PostgreSQL"],
        isCurrent: true,
        keywords: null,
        type: null,
        highlight: true,
        sortOrder: 0,
      },
    ],
  },
  title: "My version",
  description: "",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  headCommitRow?: unknown;
  insertedCommit?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    headCommitRow = { tree_id: DEFAULT_TREE_ID },
    insertedCommit = INSERTED_COMMIT,
    employeeId = null,
  } = opts;
  // null sentinel → Kysely "not found" (executeTakeFirst returns undefined)
  const resolvedBranch = branchRow === null ? undefined : branchRow;
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const educationExecute = vi.fn().mockResolvedValue([]);
  const educationOrderByThird = vi.fn().mockReturnValue({ execute: educationExecute });
  const educationOrderBySecond = vi.fn().mockReturnValue({ orderBy: educationOrderByThird });
  const educationOrderByFirst = vi.fn().mockReturnValue({ orderBy: educationOrderBySecond });
  const educationWhere = vi.fn().mockReturnValue({ orderBy: educationOrderByFirst });
  const educationSelectAll = vi.fn().mockReturnValue({ where: educationWhere });

  // Branch + resume join query
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  // Head commit lookup
  const headCommitExecuteTakeFirst = vi.fn().mockResolvedValue(headCommitRow);
  const headCommitWhere = vi.fn().mockReturnValue({ executeTakeFirst: headCommitExecuteTakeFirst });
  const headCommitSelect = vi.fn().mockReturnValue({ where: headCommitWhere });

  // Insert resume_commits
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedCommit);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });

  // Insert resume_commit_parents
  const parentInsertExecute = vi.fn().mockResolvedValue(undefined);
  const parentInsertValues = vi.fn().mockReturnValue({ execute: parentInsertExecute });

  // Generic insert stub for revision/tree tables introduced by buildCommitTree.
  // Returns a fixed revision UUID so the function completes without error.
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
    // All revision/tree tables from buildCommitTree
    return { values: treeInsertValues };
  });

  // Update branch
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  // Transaction
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
          return { innerJoin: branchInnerJoin, select: headCommitSelect };
        }),
      };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "education") return { selectAll: educationSelectAll };
    if (table === "resume_commits") return { select: headCommitSelect };
    // resume_branches join
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, insertValues, parentInsertValues, updateSet, branchWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saveResumeVersion", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(INSERTED_COMMIT.content as never);
  });

  it("creates a commit with the current resume state and advances HEAD", async () => {
    const { db, insertValues, updateSet } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID, title: "My version" });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        title: "My version",
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(updateSet).toHaveBeenCalledWith({ head_commit_id: COMMIT_ID });
  });

  it("uses generated title when no title provided", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Save resume version",
        description: "Saved the current resume snapshot without content changes.",
      })
    );
  });

  it("generates summary metadata for scalar content changes when title is omitted", async () => {
    const { db, insertValues } = buildDbMock({
      headCommitRow: { tree_id: DEFAULT_TREE_ID },
    });
    vi.mocked(readTreeContent).mockResolvedValueOnce({
      ...INSERTED_COMMIT.content,
      presentation: ["Old presentation"],
      summary: "Old summary",
    } as never);

    await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      presentation: ["New presentation"],
      summary: "New summary",
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Update presentation and summary",
        description: "Updated presentation and summary.",
      })
    );
  });

  it("starts from an empty assignments snapshot when the branch has no base commit", async () => {
    const { db } = buildDbMock();

    const result = await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result.content.assignments).toEqual([]);
  });

  it("uses forked commit content as base for the first save on a branch", async () => {
    const forkedBranchRow = {
      ...BRANCH_ROW,
      forked_from_commit_id: "550e8400-e29b-41d4-a716-446655440081",
    };
    const { db } = buildDbMock({
      branchRow: forkedBranchRow,
      headCommitRow: { tree_id: DEFAULT_TREE_ID },
    });

    const result = await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result.content.assignments).toHaveLength(1);
    expect(result.content.skills).toHaveLength(1);
    expect(vi.mocked(readTreeContent)).toHaveBeenCalledWith(db, DEFAULT_TREE_ID);
  });

  it("sets parent_commit_id to the current HEAD of the branch", async () => {
    const branchWithHead = { ...BRANCH_ROW, head_commit_id: "prev-commit-id" };
    const { db, parentInsertValues } = buildDbMock({ branchRow: branchWithHead });

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(parentInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        commit_id: COMMIT_ID,
        parent_commit_id: "prev-commit-id",
        parent_order: 0,
      })
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can save their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      saveResumeVersion(db, MOCK_CONSULTANT, { branchId: BRANCH_ID })
    ).resolves.toBeDefined();
  });

  it("uses content overrides when provided, ignoring live resume fields", async () => {
    const { db } = buildDbMock();

    const result = await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      consultantTitle: "Principal Engineer",
      presentation: ["Overridden paragraph"],
      summary: "Overridden summary",
    });

    expect(result.content.consultantTitle).toBe("Principal Engineer");
    expect(result.content.presentation).toEqual(["Overridden paragraph"]);
    expect(result.content.summary).toBe("Overridden summary");
    // Non-overridden fields still come from live resume
    expect(result.content.title).toBe("Senior Engineer");
    expect(result.content.language).toBe("en");
  });

  it("uses skills overrides when provided", async () => {
    const { db } = buildDbMock();

    const result = await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      skills: [
        { name: "Team leadership", category: "Management", sortOrder: 0 },
        { name: "Stakeholder management", category: "Management", sortOrder: 1 },
      ],
    });

    expect(result.content.skills).toEqual([
      { name: "Team leadership", category: "Management", sortOrder: 0 },
      { name: "Stakeholder management", category: "Management", sortOrder: 1 },
    ]);
  });

  it("allows setting consultantTitle to null via override", async () => {
    vi.mocked(readTreeContent).mockResolvedValueOnce({
      ...INSERTED_COMMIT.content,
      consultantTitle: "Old Title",
    } as never);
    const { db } = buildDbMock();

    const result = await saveResumeVersion(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      consultantTitle: null,
    });

    expect(result.content.consultantTitle).toBeNull();
  });

  it("includes tree_id in the commit insert", async () => {
    const { db, insertValues } = buildDbMock();

    await saveResumeVersion(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tree_id: expect.any(String),
      })
    );
  });

  it("throws FORBIDDEN when consultant tries to save another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      saveResumeVersion(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createSaveResumeVersionHandler", () => {
  it("calls saveResumeVersion with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createSaveResumeVersionHandler(db);

    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });

    expect(result.id).toBe(COMMIT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createSaveResumeVersionHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
