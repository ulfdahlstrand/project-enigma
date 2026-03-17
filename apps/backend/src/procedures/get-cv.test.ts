import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createGetCVHandler, getCV } from "./get-cv.js";

// ---------------------------------------------------------------------------
// Unit tests for the getCV procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const CV_ID = "550e8400-e29b-41d4-a716-446655440021";
const SKILL_ID_1 = "550e8400-e29b-41d4-a716-446655440031";
const SKILL_ID_2 = "550e8400-e29b-41d4-a716-446655440032";

const CV_ROW = {
  id: CV_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Backend CV",
  summary: "Experienced backend engineer",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
};

const SKILL_ROW_1 = {
  id: SKILL_ID_1,
  cv_id: CV_ID,
  name: "TypeScript",
  level: "expert",
  category: "languages",
  sort_order: 0,
};

const SKILL_ROW_2 = {
  id: SKILL_ID_2,
  cv_id: CV_ID,
  name: "Node.js",
  level: "advanced",
  category: "runtimes",
  sort_order: 1,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles both the CV lookup and skills
 * lookup that getCV performs.
 *
 * @param cvRow    - The CV row to return (undefined = not found).
 * @param skillRows - The skill rows to return.
 */
function buildDbMock(cvRow: unknown, skillRows: unknown[]) {
  // Skills query chain: selectAll → where → orderBy → execute
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  // CV query chain: selectAll → where → executeTakeFirst
  const cvExecuteTakeFirst = vi.fn().mockResolvedValue(cvRow);
  const cvWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvExecuteTakeFirst });
  const cvSelectAll = vi.fn().mockReturnValue({ where: cvWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "cv_skills") {
      return { selectAll: skillsSelectAll };
    }
    return { selectAll: cvSelectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, cvWhere, skillsWhere, skillsOrderBy, skillsExecute, cvExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(cvRow: unknown, skillRows: unknown[], employeeId: string) {
  const skillsExecute = vi.fn().mockResolvedValue(skillRows);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  const cvExecuteTakeFirst = vi.fn().mockResolvedValue(cvRow);
  const cvWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvExecuteTakeFirst });
  const cvSelectAll = vi.fn().mockReturnValue({ where: cvWhere });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "cv_skills") return { selectAll: skillsSelectAll };
    return { selectAll: cvSelectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: getCV query function
// ---------------------------------------------------------------------------

describe("getCV query function", () => {
  it("returns a CV with its skills array for an admin", async () => {
    const { db } = buildDbMock(CV_ROW, [SKILL_ROW_1, SKILL_ROW_2]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await getCV(db, adminUser, CV_ID);

    expect(result).toMatchObject({
      id: CV_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "Senior Backend CV",
      isMain: true,
    });
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0]).toMatchObject({
      id: SKILL_ID_1,
      cvId: CV_ID,
      name: "TypeScript",
      level: "expert",
      sortOrder: 0,
    });
  });

  it("returns a CV with an empty skills array when no skills exist", async () => {
    const { db } = buildDbMock(CV_ROW, []);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await getCV(db, adminUser, CV_ID);

    expect(result.skills).toEqual([]);
  });

  it("orders skills by sort_order ascending", async () => {
    const { db, skillsOrderBy } = buildDbMock(CV_ROW, [SKILL_ROW_1, SKILL_ROW_2]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    await getCV(db, adminUser, CV_ID);

    expect(skillsOrderBy).toHaveBeenCalledWith("sort_order", "asc");
  });

  it("throws NOT_FOUND when CV does not exist", async () => {
    const { db } = buildDbMock(undefined, []);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    await expect(getCV(db, adminUser, CV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fetch their own CV", async () => {
    const { db } = buildDbWithEmployeeLookup(CV_ROW, [], EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await getCV(db, consultantUser, CV_ID);

    expect(result.id).toBe(CV_ID);
  });

  it("throws FORBIDDEN when consultant tries to fetch another employee's CV", async () => {
    // CV belongs to EMPLOYEE_ID_1 but consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(CV_ROW, [], EMPLOYEE_ID_2);
    const consultantUser = { role: "consultant" as const, email: "other@example.com" };

    await expect(getCV(db, consultantUser, CV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createGetCVHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createGetCVHandler", () => {
  it("returns CV with skills for authenticated admin", async () => {
    const { db } = buildDbMock(CV_ROW, [SKILL_ROW_1]);
    const handler = createGetCVHandler(db);

    const result = await call(handler, { id: CV_ID }, {
      context: { user: { role: "admin", email: "admin@example.com" } },
    });

    expect(result.id).toBe(CV_ID);
    expect(result.skills).toHaveLength(1);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock(CV_ROW, []);
    const handler = createGetCVHandler(db);

    await expect(
      call(handler, { id: CV_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
