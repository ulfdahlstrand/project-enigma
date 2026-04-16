import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { buildExportData } from "./build-export-data.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../../resume/lib/read-tree-content.js";
import { filterDeletedAssignments } from "../../resume/lib/branch-assignment-content.js";

vi.mock("../../resume/lib/read-tree-content.js");
vi.mock("../../resume/lib/branch-assignment-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID,
  summary: null,
  language: "en",
  branch_language: "en",
  branch_name: "default",
  head_commit_id: COMMIT_ID,
  forked_from_commit_id: null,
};

const EMPLOYEE_ROW = {
  name: "Alice Smith",
  email: "alice@example.com",
  profile_image_data_url: "data:image/png;base64,display",
};

const EDUCATION_ROWS = [
  { type: "degree", value: "BSc Computer Science", sort_order: 1 },
];

const TREE_CONTENT = {
  title: "Senior Engineer",
  consultantTitle: "Tech Lead",
  presentation: ["Expert consultant"],
  summary: "Great at coding",
  highlightedItems: ["Lead hos Beta Inc"],
  language: "sv",
  skillGroups: [],
  skills: [{ name: "Go", category: null, sortOrder: 1 }],
  assignments: [
    {
      assignmentId: "550e8400-e29b-41d4-a716-446655440051",
      clientName: "Beta Inc",
      role: "Lead",
      description: "Led things",
      startDate: "2021-01-01",
      endDate: null,
      technologies: ["Go"],
      isCurrent: true,
      keywords: null,
      type: null,
      highlight: false,
      sortOrder: null,
    },
  ],
};

const COMMIT_ROW = {
  resume_id: RESUME_ID,
  tree_id: TREE_ID,
};

const BRANCH_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440061",
  name: "default",
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  resumeRow?: unknown;
  employeeRow?: unknown;
  educationRows?: unknown[];
  commitRow?: unknown;
  branchRow?: unknown;
  resolveEmployeeId?: string | null;
} = {}) {
  const {
    resumeRow = RESUME_ROW,
    employeeRow = EMPLOYEE_ROW,
    educationRows = EDUCATION_ROWS,
    commitRow = COMMIT_ROW,
    branchRow = BRANCH_ROW,
    resolveEmployeeId = null,
  } = opts;

  // resolveEmployeeId chain (employees table by email — selects just "id")
  const empByEmailResult = resolveEmployeeId ? { id: resolveEmployeeId } : undefined;
  const empByEmailExec = vi.fn().mockResolvedValue(empByEmailResult);
  const empByEmailWhere = vi.fn().mockReturnValue({ executeTakeFirst: empByEmailExec });

  // Employee by id chain (selects array of fields)
  const empByIdExec = vi.fn().mockResolvedValue(employeeRow);
  const empByIdWhere = vi.fn().mockReturnValue({ executeTakeFirst: empByIdExec });

  const empSelectDispatch = vi.fn().mockImplementation((fields: unknown) => {
    return Array.isArray(fields)
      ? { where: empByIdWhere }
      : { where: empByEmailWhere };
  });

  // Resume chain
  const resolvedResume = resumeRow === null ? undefined : resumeRow;
  const resumeExecFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeExecFirstOrThrow = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({
    executeTakeFirst: resumeExecFirst,
    executeTakeFirstOrThrow: resumeExecFirstOrThrow,
  });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  // Commit chain (returns tree_id)
  const commitExec = vi.fn().mockResolvedValue(commitRow === null ? undefined : commitRow);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExec });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  // Education chain
  const eduExec = vi.fn().mockResolvedValue(educationRows);
  const eduOrderBy = vi.fn().mockReturnValue({ execute: eduExec });
  const eduWhere = vi.fn().mockReturnValue({ orderBy: eduOrderBy });
  const eduSelectAll = vi.fn().mockReturnValue({ where: eduWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelectDispatch };
    if (table === "resumes") return { select: resumeSelect };
    if (table === "resumes as r") return { leftJoin: resumeLeftJoin };
    if (table === "resume_commits") return { select: commitSelect };
    if (table === "resume_branches") return { select: resumeSelect };
    if (table === "education") return { selectAll: eduSelectAll };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

// ---------------------------------------------------------------------------
// Live-data path
// ---------------------------------------------------------------------------

describe("buildExportData — live path (no commitId)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readTreeContent).mockResolvedValue(TREE_CONTENT as never);
    vi.mocked(filterDeletedAssignments).mockImplementation(async (_db, assignments) => assignments);
  });

  it("returns mapped export data for admin", async () => {
    const { db } = buildDbMock();

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined);

    expect(result.name).toBe("Alice Smith");
    expect(result.email).toBe("alice@example.com");
    expect(result.profileImageDataUrl).toBe("data:image/png;base64,display");
    expect(result.resumeId).toBe(RESUME_ID);
    expect(result.employeeId).toBe(EMPLOYEE_ID);
    expect(result.commitId).toBeNull();
    expect(result.language).toBe("sv");
    expect(result.branchName).toBe("default");
    expect(result.consultantTitle).toBe("Tech Lead");
    expect(result.presentation).toEqual(["Expert consultant"]);
    expect(result.skills).toEqual([{ name: "Go", category: null }]);
    expect(result.highlightedItems).toEqual(["Lead hos Beta Inc"]);
    expect(result.assignments).toHaveLength(1);
    expect(result.education).toHaveLength(1);
  });

  it("returns empty skills/highlights when no HEAD commit exists", async () => {
    const resumeWithNoCommit = { ...RESUME_ROW, head_commit_id: null, forked_from_commit_id: null };
    const { db } = buildDbMock({ resumeRow: resumeWithNoCommit });

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined);

    expect(result.skills).toEqual([]);
    expect(result.highlightedItems).toEqual([]);
    expect(result.consultantTitle).toBe("");
    expect(result.presentation).toEqual([]);
    expect(vi.mocked(readTreeContent)).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock({ resumeRow: null });

    await expect(
      buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ resolveEmployeeId: EMPLOYEE_ID_2 });

    await expect(
      buildExportData(db, MOCK_CONSULTANT_2, RESUME_ID, undefined)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("allows consultant to access their own resume", async () => {
    const { db } = buildDbMock({ resolveEmployeeId: EMPLOYEE_ID });

    await expect(
      buildExportData(db, MOCK_CONSULTANT, RESUME_ID, undefined)
    ).resolves.toMatchObject({ resumeId: RESUME_ID });
  });
});

// ---------------------------------------------------------------------------
// Live-data path with branchId (translation branches)
// ---------------------------------------------------------------------------

describe("buildExportData — live path with branchId", () => {
  const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440061";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readTreeContent).mockResolvedValue(TREE_CONTENT as never);
    vi.mocked(filterDeletedAssignments).mockImplementation(async (_db, assignments) => assignments);
  });

  it("uses branch language when tree content has no language", async () => {
    const CONTENT_NO_LANG = { ...TREE_CONTENT, language: null };
    vi.mocked(readTreeContent).mockResolvedValue(CONTENT_NO_LANG as never);

    const TRANSLATION_ROW = {
      ...RESUME_ROW,
      language: "sv",            // resume base language
      branch_language: "en",     // translation branch language
      branch_name: "main en",
    };
    const { db } = buildDbMock({ resumeRow: TRANSLATION_ROW });

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined, BRANCH_ID);

    expect(result.language).toBe("en");
    expect(result.branchName).toBe("main en");
  });

  it("falls back to resume language when branch row has no language", async () => {
    const CONTENT_NO_LANG = { ...TREE_CONTENT, language: null };
    vi.mocked(readTreeContent).mockResolvedValue(CONTENT_NO_LANG as never);

    const ROW_NO_BRANCH = {
      ...RESUME_ROW,
      language: "sv",
      branch_language: null,
      branch_name: null,
    };
    const { db } = buildDbMock({ resumeRow: ROW_NO_BRANCH });

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined, BRANCH_ID);

    expect(result.language).toBe("sv");
    expect(result.branchName).toBe("default");
  });

  it("tree content language still overrides branch language when both are present", async () => {
    const TRANSLATION_ROW = {
      ...RESUME_ROW,
      language: "sv",
      branch_language: "en",
      branch_name: "main en",
    };
    const { db } = buildDbMock({ resumeRow: TRANSLATION_ROW });

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined, BRANCH_ID);

    // TREE_CONTENT has language: "sv" — tree wins because it's authoritative
    expect(result.language).toBe("sv");
  });
});

// ---------------------------------------------------------------------------
// Snapshot path
// ---------------------------------------------------------------------------

describe("buildExportData — snapshot path (commitId provided)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readTreeContent).mockResolvedValue(TREE_CONTENT as never);
    vi.mocked(filterDeletedAssignments).mockImplementation(async (_db, assignments) => assignments);
  });

  it("returns data from commit tree, not live tables", async () => {
    const { db } = buildDbMock();

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID, BRANCH_ROW.id);

    expect(result.commitId).toBe(COMMIT_ID);
    expect(result.branchName).toBe("default");
    expect(result.profileImageDataUrl).toBe("data:image/png;base64,display");
    expect(result.language).toBe("sv");
    expect(result.consultantTitle).toBe("Tech Lead");
    expect(result.skills).toEqual([{ name: "Go", category: null }]);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.client_name).toBe("Beta Inc");
    expect(result.highlightedItems).toEqual(["Lead hos Beta Inc"]);
  });

  it("education is still fetched live in snapshot path", async () => {
    const { db } = buildDbMock();

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID);

    expect(result.education).toEqual([
      { type: "degree", value: "BSc Computer Science" },
    ]);
  });

  it("throws NOT_FOUND when commit does not exist", async () => {
    const { db } = buildDbMock({ commitRow: null });

    await expect(
      buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws BAD_REQUEST when commit belongs to a different resume", async () => {
    const { db } = buildDbMock({
      commitRow: { ...COMMIT_ROW, resume_id: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
    });

    await expect(
      buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST"
    );
  });
});
