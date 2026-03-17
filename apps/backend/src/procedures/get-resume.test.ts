import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createGetResumeHandler, getResume } from "./get-resume.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Unit tests for the getResume procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SKILL_ID_1 = "550e8400-e29b-41d4-a716-446655440031";
const SKILL_ID_2 = "550e8400-e29b-41d4-a716-446655440032";

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

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles both the resume lookup and skills
 * lookup that getResume performs.
 *
 * @param resumeRow  - The resume row to return (undefined = not found).
 * @param skillRows  - The skill rows to return.
 */
function buildDbMock(resumeRow: unknown, skillRows: unknown[]) {
  // Skills query chain: selectAll → where → orderBy → execute
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  // Resume query chain: selectAll → where → executeTakeFirst
  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelectAll = vi.fn().mockReturnValue({ where: resumeWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_skills") {
      return { selectAll: skillsSelectAll };
    }
    return { selectAll: resumeSelectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, resumeWhere, skillsWhere, skillsOrderBy, skillsExecute, resumeExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(resumeRow: unknown, skillRows: unknown[], employeeId: string) {
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resumeRow);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelectAll = vi.fn().mockReturnValue({ where: resumeWhere });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_skills") return { selectAll: skillsSelectAll };
    return { selectAll: resumeSelectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: getResume query function
// ---------------------------------------------------------------------------

describe("getResume query function", () => {
  it("returns a resume with its skills array for an admin", async () => {
    const { db } = buildDbMock(RESUME_ROW, [SKILL_ROW_1, SKILL_ROW_2]);
    const adminUser = MOCK_ADMIN;

    const result = await getResume(db, adminUser, RESUME_ID);

    expect(result).toMatchObject({
      id: RESUME_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "Senior Backend Resume",
      isMain: true,
    });
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0]).toMatchObject({
      id: SKILL_ID_1,
      cvId: RESUME_ID,
      name: "TypeScript",
      level: "expert",
      sortOrder: 0,
    });
  });

  it("returns a resume with an empty skills array when no skills exist", async () => {
    const { db } = buildDbMock(RESUME_ROW, []);
    const adminUser = MOCK_ADMIN;

    const result = await getResume(db, adminUser, RESUME_ID);

    expect(result.skills).toEqual([]);
  });

  it("orders skills by sort_order ascending", async () => {
    const { db, skillsOrderBy } = buildDbMock(RESUME_ROW, [SKILL_ROW_1, SKILL_ROW_2]);
    const adminUser = MOCK_ADMIN;

    await getResume(db, adminUser, RESUME_ID);

    expect(skillsOrderBy).toHaveBeenCalledWith("sort_order", "asc");
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock(undefined, []);
    const adminUser = MOCK_ADMIN;

    await expect(getResume(db, adminUser, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fetch their own resume", async () => {
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, [], EMPLOYEE_ID_1);
    const consultantUser = MOCK_CONSULTANT;

    const result = await getResume(db, consultantUser, RESUME_ID);

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to fetch another employee's resume", async () => {
    // Resume belongs to EMPLOYEE_ID_1 but consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(RESUME_ROW, [], EMPLOYEE_ID_2);
    const consultantUser = MOCK_CONSULTANT_2;

    await expect(getResume(db, consultantUser, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
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
