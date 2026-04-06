import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createGetResumeHandler, getResume } from "./get.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Unit tests for the getResume procedure.
// ---------------------------------------------------------------------------

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
  consultant_title: null,
  presentation: [],
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  branch_id: BRANCH_ID,
  head_commit_id: COMMIT_ID,
};

const SKILL_ROW_1 = {
  id: SKILL_ID_1,
  cv_id: RESUME_ID,
  name: "TypeScript",
  level: "expert",
  category: "languages",
  sort_order: 0,
};

const SKILL_ROW_2 = {
  id: SKILL_ID_2,
  cv_id: RESUME_ID,
  name: "Node.js",
  level: "advanced",
  category: "runtimes",
  sort_order: 1,
};

const HIGHLIGHTED_ITEM_ROW_1 = { text: "Principal Engineer hos Acme" };
const HIGHLIGHTED_ITEM_ROW_2 = { text: "Tech Lead hos Beta" };

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles both the resume LEFT JOIN lookup
 * and the skills query that getResume performs.
 */
function buildDbMock(resumeRow: unknown, skillRows: unknown[], highlightedItemRows: unknown[] = []) {
  // Skills query chain: selectAll → where → orderBy → execute
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  const highlightedExecute = vi.fn().mockResolvedValue(highlightedItemRows);
  const highlightedOrderBy = vi.fn().mockReturnValue({ execute: highlightedExecute });
  const highlightedWhere = vi.fn().mockReturnValue({ orderBy: highlightedOrderBy });
  const highlightedSelect = vi.fn().mockReturnValue({ where: highlightedWhere });

  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });

  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  // Resume query chain with LEFT JOIN: leftJoin → select → where → executeTakeFirst
  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_skills") return { selectAll: skillsSelectAll };
    if (table === "resume_highlighted_items") return { select: highlightedSelect };
    if (table === "resume_branches") return { select: branchSelect };
    if (table === "resume_commits") return { select: commitSelect };
    return { leftJoin: resumeLeftJoin };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return {
    db,
    selectFrom,
    resumeWhere,
    skillsWhere,
    skillsOrderBy,
    skillsExecute,
    resumeExecuteTakeFirst,
    branchExecuteTakeFirst,
    commitExecuteTakeFirst,
  };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(
  resumeRow: unknown,
  skillRows: unknown[],
  employeeId: string,
  highlightedItemRows: unknown[] = [],
) {
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  const highlightedExecute = vi.fn().mockResolvedValue(highlightedItemRows);
  const highlightedOrderBy = vi.fn().mockReturnValue({ execute: highlightedExecute });
  const highlightedWhere = vi.fn().mockReturnValue({ orderBy: highlightedOrderBy });
  const highlightedSelect = vi.fn().mockReturnValue({ where: highlightedWhere });

  const commitExecuteTakeFirst = vi.fn().mockResolvedValue({
    content: {
      title: "Committed title",
      consultantTitle: null,
      presentation: [],
      summary: "Committed summary",
      highlightedItems: [],
      language: "en",
      skills: [],
      assignments: [],
    },
  });
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
    if (table === "resume_skills") return { selectAll: skillsSelectAll };
    if (table === "resume_highlighted_items") return { select: highlightedSelect };
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
  it("returns a resume with its skills array for an admin", async () => {
    const { db, commitExecuteTakeFirst } = buildDbMock(
      RESUME_ROW,
      [SKILL_ROW_1, SKILL_ROW_2],
      [HIGHLIGHTED_ITEM_ROW_1]
    );
    commitExecuteTakeFirst.mockResolvedValue({
      content: {
        title: "Committed title",
        consultantTitle: "Committed consultant",
        presentation: ["Committed presentation"],
        summary: "Committed summary",
        highlightedItems: ["Committed highlight"],
        language: "sv",
        skills: [],
        assignments: [],
      },
    });

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
      id: SKILL_ID_1,
      resumeId: RESUME_ID,
      name: "TypeScript",
      level: "expert",
      sortOrder: 0,
    });
    expect(result.highlightedItems).toEqual(["Committed highlight"]);
  });

  it("returns highlighted items ordered by sort_order ascending", async () => {
    const { db } = buildDbMock(RESUME_ROW, [], [HIGHLIGHTED_ITEM_ROW_1, HIGHLIGHTED_ITEM_ROW_2]);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.highlightedItems).toEqual([
      "Principal Engineer hos Acme",
      "Tech Lead hos Beta",
    ]);
  });

  it("includes mainBranchId and headCommitId from the LEFT JOIN", async () => {
    const { db } = buildDbMock(RESUME_ROW, []);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.mainBranchId).toBe(BRANCH_ID);
    expect(result.headCommitId).toBe(COMMIT_ID);
  });

  it("returns null for mainBranchId and headCommitId when no branch exists", async () => {
    const nobranchRow = { ...RESUME_ROW, branch_id: null, head_commit_id: null };
    const { db } = buildDbMock(nobranchRow, []);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.mainBranchId).toBeNull();
    expect(result.headCommitId).toBeNull();
  });

  it("returns a resume with an empty skills array when no skills exist", async () => {
    const { db } = buildDbMock(RESUME_ROW, []);

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(result.skills).toEqual([]);
  });

  it("orders skills by sort_order ascending", async () => {
    const { db, skillsOrderBy } = buildDbMock(RESUME_ROW, [SKILL_ROW_1, SKILL_ROW_2]);

    await getResume(db, MOCK_ADMIN, RESUME_ID);

    expect(skillsOrderBy).toHaveBeenCalledWith("sort_order", "asc");
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock(undefined, []);

    await expect(getResume(db, MOCK_ADMIN, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fetch their own resume", async () => {
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, [], EMPLOYEE_ID_1);

    const result = await getResume(db, MOCK_CONSULTANT, RESUME_ID);

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to fetch another employee's resume", async () => {
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, [], EMPLOYEE_ID_2);

    await expect(getResume(db, MOCK_CONSULTANT_2, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("uses the selected branch snapshot when branchId is provided", async () => {
    const { db, branchExecuteTakeFirst, commitExecuteTakeFirst } = buildDbMock(RESUME_ROW, []);
    branchExecuteTakeFirst.mockResolvedValue({
      id: REVISION_BRANCH_ID,
      resume_id: RESUME_ID,
      head_commit_id: null,
      forked_from_commit_id: REVISION_COMMIT_ID,
    });
    commitExecuteTakeFirst.mockResolvedValue({
      content: {
        title: "Branch title",
        consultantTitle: "Branch consultant",
        presentation: ["Branch presentation"],
        summary: "Branch summary",
        highlightedItems: ["Branch highlight"],
        language: "en",
        skills: [],
        assignments: [],
      },
    });

    const result = await getResume(db, MOCK_ADMIN, RESUME_ID, REVISION_BRANCH_ID);

    expect(result.title).toBe("Branch title");
    expect(result.presentation).toEqual(["Branch presentation"]);
    expect(result.summary).toBe("Branch summary");
    expect(result.highlightedItems).toEqual(["Branch highlight"]);
  });

  it("throws NOT_FOUND when the requested branch does not belong to the resume", async () => {
    const { db, branchExecuteTakeFirst } = buildDbMock(RESUME_ROW, []);
    branchExecuteTakeFirst.mockResolvedValue({
      id: REVISION_BRANCH_ID,
      resume_id: "550e8400-e29b-41d4-a716-446655440099",
      head_commit_id: null,
      forked_from_commit_id: REVISION_COMMIT_ID,
    });

    await expect(getResume(db, MOCK_ADMIN, RESUME_ID, REVISION_BRANCH_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createGetResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createGetResumeHandler", () => {
  it("returns resume with skills for authenticated admin", async () => {
    const { db } = buildDbMock(RESUME_ROW, [SKILL_ROW_1]);
    const handler = createGetResumeHandler(db);

    const result = await call(handler, { id: RESUME_ID }, {
      context: { user: MOCK_ADMIN },
    });

    expect(result.id).toBe(RESUME_ID);
    expect(result.skills).toHaveLength(1);
    expect(result.mainBranchId).toBe(BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock(RESUME_ROW, []);
    const handler = createGetResumeHandler(db);

    await expect(
      call(handler, { id: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
