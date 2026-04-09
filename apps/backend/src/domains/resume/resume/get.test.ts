import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createGetResumeHandler, getResume } from "./get.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Unit tests for the getResume procedure.
// ---------------------------------------------------------------------------

const DEFAULT_TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const REVISION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const REVISION_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const SKILL_ID_1 = "550e8400-e29b-41d4-a716-446655440051";
const SKILL_ID_2 = "550e8400-e29b-41d4-a716-446655440052";

// Resume row now includes branch_id and head_commit_id from the LEFT JOIN
const RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Backend Resume",
  summary: "Experienced backend engineer",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  branch_id: BRANCH_ID,
  head_commit_id: COMMIT_ID,
};

const SKILL_ROW_1 = {
  id: SKILL_ID_1,
  resume_id: RESUME_ID,
  group_id: "550e8400-e29b-41d4-a716-446655440061",
  name: "TypeScript",
  group_name: "languages",
  group_sort_order: 0,
  sort_order: 0,
};

const SKILL_ROW_2 = {
  id: SKILL_ID_2,
  resume_id: RESUME_ID,
  group_id: "550e8400-e29b-41d4-a716-446655440062",
  name: "Node.js",
  group_name: "runtimes",
  group_sort_order: 1,
  sort_order: 1,
};

const HIGHLIGHTED_ITEM_ROW_1 = { text: "Principal Engineer hos Acme" };
const HIGHLIGHTED_ITEM_ROW_2 = { text: "Tech Lead hos Beta" };

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles the resume LEFT JOIN lookup
 * and the commit tree lookup that getResume performs.
 */
function buildDbMock(resumeRow: unknown) {
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue({ tree_id: DEFAULT_TREE_ID });
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_commits") return { select: commitSelect };
    return { leftJoin: resumeLeftJoin };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, resumeExecuteTakeFirst, commitExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(resumeRow: unknown, employeeId: string) {
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue({ tree_id: DEFAULT_TREE_ID });
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commits") return { select: commitSelect };
    return { leftJoin: resumeLeftJoin };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: getResume query function
// ---------------------------------------------------------------------------

describe("getResume query function", () => {
  const COMMITTED_CONTENT = {
    title: "Committed title",
    consultantTitle: "Committed consultant",
    presentation: ["Committed presentation"],
    summary: "Committed summary",
    highlightedItems: ["Committed highlight"],
    language: "sv",
    skillGroups: [
      { name: "languages", sortOrder: 0 },
      { name: "runtimes", sortOrder: 1 },
    ],
    skills: [
      { name: "TypeScript", category: "languages", sortOrder: 0 },
      { name: "Node.js", category: "runtimes", sortOrder: 1 },
    ],
    assignments: [],
  };

  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(COMMITTED_CONTENT as never);
  });

  it("returns resume fields from tree content for an admin", async () => {
    const { db } = buildDbMock(RESUME_ROW);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result).toMatchObject({
      id: RESUME_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "Committed title",
      consultantTitle: "Committed consultant",
      presentation: ["Committed presentation"],
      summary: "Committed summary",
      highlightedItems: ["Committed highlight"],
      language: "sv",
      isMain: true,
    });
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0]).toMatchObject({
      resumeId: RESUME_ID,
      name: "TypeScript",
      category: "languages",
      sortOrder: 0,
    });
    expect(result.skills[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(result.skillGroups).toEqual([
      expect.objectContaining({ name: "languages", sortOrder: 0 }),
      expect.objectContaining({ name: "runtimes", sortOrder: 1 }),
    ]);
  });

  it("includes mainBranchId and headCommitId from the LEFT JOIN", async () => {
    const { db } = buildDbMock(RESUME_ROW);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.mainBranchId).toBe(BRANCH_ID);
    expect(result.headCommitId).toBe(COMMIT_ID);
  });

  it("returns null for mainBranchId and headCommitId when no branch exists", async () => {
    const nobranchRow = { ...RESUME_ROW, branch_id: null, head_commit_id: null };
    const { db } = buildDbMock(nobranchRow);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.mainBranchId).toBeNull();
    expect(result.headCommitId).toBeNull();
  });

  it("returns empty skills when commit has no tree_id", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    commitExecuteTakeFirst.mockResolvedValue({ tree_id: null });

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.skills).toEqual([]);
    expect(result.skillGroups).toEqual([]);
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock(undefined);

    await expect(getResume(db, MOCK_ADMIN, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fetch their own resume", async () => {
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, EMPLOYEE_ID_1);

    const result = await getResume(db, MOCK_CONSULTANT, RESUME_ID);

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to fetch another employee's resume", async () => {
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, EMPLOYEE_ID_2);

    await expect(getResume(db, MOCK_CONSULTANT_2, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: commit-first read (commitId provided)
// ---------------------------------------------------------------------------

describe("getResume — commit-first read (commitId provided)", () => {
  const EXACT_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440099";
  const EXACT_TREE_ID = "550e8400-e29b-41d4-a716-000000000088";

  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue({
      title: "Default tree title",
      consultantTitle: null,
      presentation: [],
      summary: null,
      highlightedItems: [],
      language: "en",
      skillGroups: [],
      skills: [],
      assignments: [],
    } as never);
  });

  it("returns content from tree when commitId is provided", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    const historicalContent = {
      title: "Historical title",
      consultantTitle: "Historical consultant",
      presentation: ["Historical presentation"],
      summary: "Historical summary",
      highlightedItems: ["Historical highlight"],
      language: "sv",
      skillGroups: [{ name: "platforms", sortOrder: 0 }],
      skills: [{ name: "AWS", category: "platforms", sortOrder: 0 }],
      assignments: [],
    };
    commitExecuteTakeFirst.mockResolvedValueOnce({
      id: EXACT_COMMIT_ID,
      resume_id: RESUME_ID,
      tree_id: EXACT_TREE_ID,
    });
    vi.mocked(readTreeContent).mockResolvedValueOnce(historicalContent as never);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID, EXACT_COMMIT_ID);

    expect(result.title).toBe("Historical title");
    expect(result.consultantTitle).toBe("Historical consultant");
    expect(result.presentation).toEqual(["Historical presentation"]);
    expect(result.summary).toBe("Historical summary");
    expect(result.language).toBe("sv");
    expect(result.skillGroups).toEqual([
      expect.objectContaining({ resumeId: RESUME_ID, name: "platforms", sortOrder: 0 }),
    ]);
    expect(result.skills).toEqual([
      expect.objectContaining({ resumeId: RESUME_ID, name: "AWS", category: "platforms" }),
    ]);
    expect(result.skillGroups[0]?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.skills[0]?.groupId).toBe(result.skillGroups[0]?.id);
  });

  it("tree data wins over live resume row fields", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    commitExecuteTakeFirst.mockResolvedValueOnce({
      id: EXACT_COMMIT_ID,
      resume_id: RESUME_ID,
      tree_id: EXACT_TREE_ID,
    });
    vi.mocked(readTreeContent).mockResolvedValueOnce({
      title: "Snapshot title",
      consultantTitle: null,
      presentation: [],
      summary: "Snapshot summary",
      highlightedItems: [],
      language: "en",
      skillGroups: [],
      skills: [],
      assignments: [],
    } as never);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID, EXACT_COMMIT_ID);

    expect(result.title).toBe("Snapshot title");
    expect(result.title).not.toBe(RESUME_ROW.title);
  });

  it("throws NOT_FOUND when the commit does not belong to the resume", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    commitExecuteTakeFirst.mockResolvedValueOnce({
      id: EXACT_COMMIT_ID,
      resume_id: "550e8400-e29b-41d4-a716-000000000000",
      tree_id: EXACT_TREE_ID,
    });

    await expect(
      getResume(db, MOCK_ADMIN, RESUME_ID, EXACT_COMMIT_ID)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws NOT_FOUND when the commit does not exist", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    commitExecuteTakeFirst.mockResolvedValueOnce(undefined);

    await expect(
      getResume(db, MOCK_ADMIN, RESUME_ID, EXACT_COMMIT_ID)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: tree-based read path (tree_id set on commit)
// ---------------------------------------------------------------------------

const TREE_ID = "550e8400-e29b-41d4-a716-446655440090";

/**
 * Builds a mock where the commit has tree_id set.
 * The selectFrom mock handles all tree + revision tables so readTreeContent
 * can complete without hitting a real database.
 */
function buildDbMockWithTree(opts: {
  commitTreeId?: string;
  treeEntries?: unknown[];
  entryContentByEntryId?: Record<string, unknown>;
  revisionsByRevId?: Record<string, unknown>;
} = {}) {
  const {
    commitTreeId = TREE_ID,
    treeEntries = [
      { id: "te1", tree_id: TREE_ID, entry_type: "metadata", position: 0 },
      { id: "te2", tree_id: TREE_ID, entry_type: "presentation", position: 1 },
      { id: "te3", tree_id: TREE_ID, entry_type: "summary", position: 2 },
      { id: "te4", tree_id: TREE_ID, entry_type: "highlighted_items", position: 3 },
    ],
    entryContentByEntryId = {
      te1: { revision_id: "rv1", revision_type: "resume_revision_metadata" },
      te2: { revision_id: "rv2", revision_type: "resume_revision_presentation" },
      te3: { revision_id: "rv3", revision_type: "resume_revision_summary" },
      te4: { revision_id: "rv4", revision_type: "resume_revision_highlighted_item" },
    },
    revisionsByRevId = {
      rv1: { id: "rv1", title: "Tree title", language: "sv" },
      rv2: { id: "rv2", paragraphs: ["Tree paragraph"] },
      rv3: { id: "rv3", content: "Tree summary" },
      rv4: { id: "rv4", items: ["Tree highlight"] },
    },
  } = opts;

  const resumeRow = { ...RESUME_ROW, head_commit_id: COMMIT_ID };

  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  const commitRow = {
    id: COMMIT_ID,
    resume_id: RESUME_ID,
    tree_id: commitTreeId,
    content: { title: "JSON title", consultantTitle: null, presentation: [], summary: null,
               highlightedItems: [], language: "en", skillGroups: [], skills: [], assignments: [] },
  };
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(commitRow);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resumes as r") return { leftJoin: resumeLeftJoin };
    if (table === "resume_commits") return { select: commitSelect };

    if (table === "resume_tree_entries") {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(treeEntries),
            }),
          }),
        }),
      };
    }

    if (table === "resume_tree_entry_content") {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation((_col: string, _op: string, entryId: string) => ({
            executeTakeFirst: vi.fn().mockResolvedValue(
              (entryContentByEntryId as Record<string, unknown>)[entryId]
            ),
          })),
        }),
      };
    }

    // All revision tables — look up by revision id
    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((_col: string, _op: string, revId: string) => ({
          executeTakeFirst: vi.fn().mockResolvedValue(
            (revisionsByRevId as Record<string, unknown>)[revId]
          ),
        })),
      }),
    };
  });

  return { db: { selectFrom } as unknown as Kysely<Database>, commitExecuteTakeFirst };
}

describe("getResume — tree-based read path (tree_id set)", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue({
      title: "Tree title",
      consultantTitle: null,
      presentation: ["Tree paragraph"],
      summary: "Tree summary",
      highlightedItems: ["Tree highlight"],
      language: "sv",
      skillGroups: [],
      skills: [],
      assignments: [],
    } as never);
  });

  it("reads title from metadata revision when tree_id is set", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    expect(result.title).toBe("Tree title");
  });

  it("reads language from metadata revision when tree_id is set", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    expect(result.language).toBe("sv");
  });

  it("reads presentation from presentation revision", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    expect(result.presentation).toEqual(["Tree paragraph"]);
  });

  it("reads summary from summary revision", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    expect(result.summary).toBe("Tree summary");
  });

  it("reads highlightedItems from highlighted_item revision", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    expect(result.highlightedItems).toEqual(["Tree highlight"]);
  });

  it("PARITY: tree-based output title does not come from legacy JSON content", async () => {
    const { db } = buildDbMockWithTree();
    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);
    // JSON content has title "JSON title" — tree must win
    expect(result.title).toBe("Tree title");
    expect(result.title).not.toBe("JSON title");
  });
});

// ---------------------------------------------------------------------------
// Tests: createGetResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createGetResumeHandler", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue({
      title: "Handler title",
      consultantTitle: null,
      presentation: [],
      summary: null,
      highlightedItems: [],
      language: "en",
      skillGroups: [{ name: "languages", sortOrder: 0 }],
      skills: [{ name: "TypeScript", category: "languages", sortOrder: 0 }],
      assignments: [],
    } as never);
  });

  it("returns resume with skills for authenticated admin", async () => {
    const { db } = buildDbMock(RESUME_ROW);
    const handler = createGetResumeHandler(db);

    const result = await call(handler, { id: RESUME_ID }, {
      context: { user: MOCK_ADMIN },
    });

    expect(result.id).toBe(RESUME_ID);
    expect(result.skills).toHaveLength(1);
    expect(result.mainBranchId).toBe(BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock(RESUME_ROW);
    const handler = createGetResumeHandler(db);

    await expect(
      call(handler, { id: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });

  it("passes commitId through the handler to get an exact commit view", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW);
    const handler = createGetResumeHandler(db);
    commitExecuteTakeFirst.mockResolvedValueOnce({
      id: COMMIT_ID,
      resume_id: RESUME_ID,
      tree_id: DEFAULT_TREE_ID,
    });
    vi.mocked(readTreeContent).mockResolvedValueOnce({
      title: "Handler commit snapshot",
      consultantTitle: null,
      presentation: [],
      summary: null,
      highlightedItems: [],
      language: "en",
      skillGroups: [],
      skills: [],
      assignments: [],
    } as never);

    const result = await call(handler, { id: RESUME_ID, commitId: COMMIT_ID }, {
      context: { user: MOCK_ADMIN },
    });

    expect(result.title).toBe("Handler commit snapshot");
  });
});
