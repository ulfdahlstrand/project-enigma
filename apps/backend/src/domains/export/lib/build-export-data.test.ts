import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { buildExportData } from "./build-export-data.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";

const RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID,
  consultant_title: null,
  presentation: ["I build things"],
  summary: null,
  language: "en",
  title: "Engineer",
  is_main: true,
};

const EMPLOYEE_ROW = {
  id: EMPLOYEE_ID,
  name: "Alice Smith",
  email: "alice@example.com",
};

const SKILL_ROWS = [
  { name: "TypeScript", category: "Languages", level: "Expert", sort_order: 1 },
];

const ASSIGNMENT_ROWS = [
  {
    role: "Engineer",
    client_name: "Acme Corp",
    start_date: "2020-01-01",
    end_date: null,
    is_current: true,
    type: null,
    technologies: ["TypeScript"],
    keywords: null,
    description: "Built things",
  },
];

const EDUCATION_ROWS = [
  { type: "degree", value: "BSc Computer Science", sort_order: 1 },
];

const COMMIT_CONTENT = {
  title: "Senior Engineer",
  consultantTitle: "Tech Lead",
  presentation: ["Expert consultant"],
  summary: "Great at coding",
  language: "sv",
  skills: [{ name: "Go", level: null, category: null, sortOrder: 1 }],
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
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  content: COMMIT_CONTENT,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  resumeRow?: unknown;
  employeeRow?: unknown;
  skillRows?: unknown[];
  assignmentRows?: unknown[];
  educationRows?: unknown[];
  commitRow?: unknown;
  resolveEmployeeId?: string | null;
} = {}) {
  const {
    resumeRow = RESUME_ROW,
    employeeRow = EMPLOYEE_ROW,
    skillRows = SKILL_ROWS,
    assignmentRows = ASSIGNMENT_ROWS,
    educationRows = EDUCATION_ROWS,
    commitRow = null,
    resolveEmployeeId = null,
  } = opts;

  // resolveEmployeeId chain (employees table by email — selects just "id")
  const empByEmailResult = resolveEmployeeId ? { id: resolveEmployeeId } : undefined;
  const empByEmailExec = vi.fn().mockResolvedValue(empByEmailResult);
  const empByEmailWhere = vi.fn().mockReturnValue({ executeTakeFirst: empByEmailExec });

  // Employee by id chain (selects ["id","name","email"])
  const empByIdExec = vi.fn().mockResolvedValue(employeeRow);
  const empByIdWhere = vi.fn().mockReturnValue({ executeTakeFirst: empByIdExec });

  // Dispatch: when select receives a string it's resolveEmployeeId ("id");
  // when it receives an array it's the full employee lookup.
  const empSelectDispatch = vi.fn().mockImplementation((fields: unknown) => {
    return Array.isArray(fields)
      ? { where: empByIdWhere }
      : { where: empByEmailWhere };
  });

  // Resume chain (used both as `select(...)` for ownership check and `selectAll()` in buildFromLive)
  const resolvedResume = resumeRow === null ? undefined : resumeRow;
  const resumeExecFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeExecFirstOrThrow = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({
    executeTakeFirst: resumeExecFirst,
    executeTakeFirstOrThrow: resumeExecFirstOrThrow,
  });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });
  const resumeSelectAll = vi.fn().mockReturnValue({ where: resumeWhere });

  // Commit chain
  const commitExec = vi.fn().mockResolvedValue(commitRow === null ? undefined : commitRow);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExec });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });

  // Skills chain
  const skillsExec = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExec });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelect = vi.fn().mockReturnValue({ where: skillsWhere });

  // Assignments chain — now via branch_assignments join
  const assignExec = vi.fn().mockResolvedValue(assignmentRows);
  const assignOrderBy3 = vi.fn().mockReturnValue({ execute: assignExec });
  const assignOrderBy2 = vi.fn().mockReturnValue({ orderBy: assignOrderBy3 });
  const assignOrderBy1 = vi.fn().mockReturnValue({ orderBy: assignOrderBy2 });
  const assignWhere2 = vi.fn().mockReturnValue({ orderBy: assignOrderBy1 });
  const assignWhere1 = vi.fn().mockReturnValue({ where: assignWhere2, orderBy: assignOrderBy1 });
  const assignSelectAll = vi.fn().mockReturnValue({ where: assignWhere1 });
  const assignInnerJoin1 = vi.fn().mockReturnValue({ selectAll: assignSelectAll });

  // Education chain
  const eduExec = vi.fn().mockResolvedValue(educationRows);
  const eduOrderBy = vi.fn().mockReturnValue({ execute: eduExec });
  const eduWhere = vi.fn().mockReturnValue({ orderBy: eduOrderBy });
  const eduSelectAll = vi.fn().mockReturnValue({ where: eduWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelectDispatch };
    if (table === "resumes") return { select: resumeSelect, selectAll: resumeSelectAll };
    if (table === "resume_commits") return { select: commitSelect };
    if (table === "resume_skills") return { selectAll: skillsSelect };
    if (table === "branch_assignments as ba") return { innerJoin: assignInnerJoin1 };
    if (table === "education") return { selectAll: eduSelectAll };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

// ---------------------------------------------------------------------------
// Live-data path
// ---------------------------------------------------------------------------

describe("buildExportData — live path (no commitId)", () => {
  it("returns mapped export data for admin", async () => {
    const { db } = buildDbMock();

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, undefined);

    expect(result.name).toBe("Alice Smith");
    expect(result.email).toBe("alice@example.com");
    expect(result.resumeId).toBe(RESUME_ID);
    expect(result.employeeId).toBe(EMPLOYEE_ID);
    expect(result.commitId).toBeNull();
    expect(result.skills).toHaveLength(1);
    expect(result.assignments).toHaveLength(1);
    expect(result.education).toHaveLength(1);
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
// Snapshot path
// ---------------------------------------------------------------------------

describe("buildExportData — snapshot path (commitId provided)", () => {
  it("returns data from commit snapshot, not live tables", async () => {
    const { db } = buildDbMock({ commitRow: COMMIT_ROW });

    const result = await buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID);

    expect(result.commitId).toBe(COMMIT_ID);
    expect(result.language).toBe("sv");
    expect(result.consultantTitle).toBe("Tech Lead");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("Go");
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].client_name).toBe("Beta Inc");
  });

  it("education is still fetched live in snapshot path", async () => {
    const { db } = buildDbMock({ commitRow: COMMIT_ROW });

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
    const wrongResumeCommit = {
      ...COMMIT_ROW,
      resume_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    };
    const { db } = buildDbMock({ commitRow: wrongResumeCommit });

    await expect(
      buildExportData(db, MOCK_ADMIN, RESUME_ID, COMMIT_ID)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST"
    );
  });
});
