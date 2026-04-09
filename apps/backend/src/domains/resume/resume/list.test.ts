import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createListResumesHandler, listResumes } from "./list.js";
import { MOCK_ADMIN, MOCK_CONSULTANT } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Unit tests for the listResumes procedure.
//
// A mock Kysely instance is injected via the factory so no real database
// connection is required. The auth context is injected through call() options.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID_1 = "550e8400-e29b-41d4-a716-446655440021";
const RESUME_ID_2 = "550e8400-e29b-41d4-a716-446655440022";
const BRANCH_ID_1 = "550e8400-e29b-41d4-a716-446655440031";
const COMMIT_ID_1 = "550e8400-e29b-41d4-a716-446655440041";

// Resume rows now include branch_id and head_commit_id from the LEFT JOIN
const RESUME_ROW_1 = {
  id: RESUME_ID_1,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Backend Resume",
  summary: "Experienced backend engineer",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  branch_id: BRANCH_ID_1,
  head_commit_id: COMMIT_ID_1,
};

const RESUME_ROW_2 = {
  id: RESUME_ID_2,
  employee_id: EMPLOYEE_ID_2,
  title: "Frontend Developer Resume",
  summary: null,
  language: "sv",
  is_main: false,
  created_at: new Date("2025-02-01T00:00:00.000Z"),
  updated_at: new Date("2025-02-01T00:00:00.000Z"),
  branch_id: null,
  head_commit_id: null,
};

const DEFAULT_TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const COMMIT_ROW_1 = {
  id: COMMIT_ID_1,
  tree_id: DEFAULT_TREE_ID,
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely fluent chain that handles the LEFT JOIN query:
 * selectFrom("resumes as r") → leftJoin → select → where? → execute
 */
function buildSelectMock(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const whereChain = { execute, where: vi.fn() };
  whereChain.where.mockReturnValue(whereChain);
  const select = vi.fn().mockReturnValue({ execute, where: whereChain.where });
  const leftJoin = vi.fn().mockReturnValue({ select });
  const commitExecute = vi.fn().mockResolvedValue([COMMIT_ROW_1]);
  const commitWhere = vi.fn().mockReturnValue({ execute: commitExecute });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const selectFrom = vi.fn().mockReturnValue({ leftJoin });
  selectFrom.mockImplementation((table: string) => {
    if (table === "resume_commits") return { select: commitSelect };
    return { leftJoin };
  });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, leftJoin, select, execute, where: whereChain.where, commitExecute };
}

/** Builds a mock for the employees lookup used by resolveEmployeeId. */
function buildDbWithEmployeeLookup(resumeRows: unknown[], employeeId: string) {
  const resumeExecute = vi.fn().mockResolvedValue(resumeRows);
  const resumeWhereChain: { execute: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } = {
    execute: resumeExecute,
    where: vi.fn(),
  };
  resumeWhereChain.where.mockReturnValue(resumeWhereChain);
  const resumeSelect = vi.fn().mockReturnValue({ execute: resumeExecute, where: resumeWhereChain.where });
  const resumeLeftJoin = vi.fn().mockReturnValue({ select: resumeSelect });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });
  const commitExecute = vi.fn().mockResolvedValue([COMMIT_ROW_1]);
  const commitWhere = vi.fn().mockReturnValue({ execute: commitExecute });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commits") return { select: commitSelect };
    return { leftJoin: resumeLeftJoin };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, resumeExecute };
}

// ---------------------------------------------------------------------------
// Tests: listResumes query function
// ---------------------------------------------------------------------------

describe("listResumes query function", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue({
      title: "Senior Backend Resume",
      consultantTitle: "Tech Lead",
      presentation: ["Committed presentation"],
      summary: "Experienced backend engineer",
      highlightedItems: [],
      language: "en",
      skillGroups: [],
      skills: [],
      assignments: [],
    } as never);
  });

  it("returns all resumes for admin with no filters", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1, RESUME_ROW_2]);

    const result = await listResumes(db, MOCK_ADMIN, {});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: RESUME_ID_1,
      employeeId: EMPLOYEE_ID_1,
      title: "Senior Backend Resume",
      isMain: true,
      language: "en",
    });
  });

  it("returns empty array when no resumes exist", async () => {
    const { db } = buildSelectMock([]);

    const result = await listResumes(db, MOCK_ADMIN, {});

    expect(result).toEqual([]);
  });

  it("includes mainBranchId and headCommitId from the LEFT JOIN", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1]);

    const result = await listResumes(db, MOCK_ADMIN, {});

    expect(result[0]).toMatchObject({
      mainBranchId: BRANCH_ID_1,
      headCommitId: COMMIT_ID_1,
    });
  });

  it("returns null for mainBranchId and headCommitId when no branch exists", async () => {
    const { db } = buildSelectMock([RESUME_ROW_2]);

    const result = await listResumes(db, MOCK_ADMIN, {});

    expect(result[0]?.mainBranchId).toBeNull();
    expect(result[0]?.headCommitId).toBeNull();
  });

  it("consultant only sees resumes belonging to their own employee record", async () => {
    const { db, resumeExecute } = buildDbWithEmployeeLookup([RESUME_ROW_1], EMPLOYEE_ID_1);

    await listResumes(db, MOCK_CONSULTANT, {});

    expect(resumeExecute).toHaveBeenCalledTimes(1);
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1]);

    const result = await listResumes(db, MOCK_ADMIN, {});

    expect(result[0]).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: true,
      createdAt: RESUME_ROW_1.created_at,
      updatedAt: RESUME_ROW_1.updated_at,
    });
    expect(result[0]).not.toHaveProperty("employee_id");
    expect(result[0]).not.toHaveProperty("is_main");
  });
});

// ---------------------------------------------------------------------------
// Tests: createListResumesHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createListResumesHandler", () => {
  it("returns all resumes when called by an admin", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1, RESUME_ROW_2]);
    const handler = createListResumesHandler(db);

    const result = await call(handler, {}, {
      context: { user: MOCK_ADMIN },
    });

    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user is in context", async () => {
    const { db } = buildSelectMock([]);
    const handler = createListResumesHandler(db);

    await expect(
      call(handler, {}, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });

  it("consultant only sees own resumes (ignores employeeId input filter for ownership)", async () => {
    const { db } = buildDbWithEmployeeLookup([RESUME_ROW_1], EMPLOYEE_ID_1);
    const handler = createListResumesHandler(db);

    const result = await call(handler, {}, {
      context: { user: MOCK_CONSULTANT },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(RESUME_ID_1);
  });
});
