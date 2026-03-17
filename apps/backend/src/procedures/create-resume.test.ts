import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createCreateResumeHandler, createResume } from "./create-resume.js";

// ---------------------------------------------------------------------------
// Unit tests for the createResume procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";

const NEW_RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "New Backend Resume",
  summary: null,
  language: "en",
  is_main: false,
  created_at: new Date("2025-03-01T00:00:00.000Z"),
  updated_at: new Date("2025-03-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles the resume insert and skills query
 * that createResume performs.
 */
function buildInsertMock(insertedRow: unknown) {
  // Skills query (returns empty array since newly created resumes have no skills)
  const skillsExecute = vi.fn().mockResolvedValue([]);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  // Resume insert chain
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = vi.fn().mockReturnValue({ returningAll });
  const insertInto = vi.fn().mockReturnValue({ values });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_skills") return { selectAll: skillsSelectAll };
    return {};
  });

  const db = { insertInto, selectFrom } as unknown as Kysely<Database>;
  return { db, insertInto, values, returningAll, executeTakeFirstOrThrow, skillsExecute };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(
  insertedRow: unknown,
  employeeId: string
) {
  const skillsExecute = vi.fn().mockResolvedValue([]);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = vi.fn().mockReturnValue({ returningAll });
  const insertInto = vi.fn().mockReturnValue({ values });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_skills") return { selectAll: skillsSelectAll };
    return {};
  });

  const db = { insertInto, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

/** Builds a db mock where the employee lookup returns undefined (consultant not found). */
function buildDbWithMissingEmployee() {
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const insertInto = vi.fn();

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return {};
  });

  const db = { insertInto, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: createResume query function
// ---------------------------------------------------------------------------

describe("createResume query function", () => {
  it("admin creates resume for any employee and returns resume with empty skills array", async () => {
    const { db, values } = buildInsertMock(NEW_RESUME_ROW);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await createResume(db, adminUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      id: RESUME_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
    });
    expect(result.skills).toEqual([]);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: EMPLOYEE_ID_1,
        title: "New Backend Resume",
        language: "en",
      })
    );
  });

  it("consultant creates resume for their own employee_id and succeeds", async () => {
    const { db } = buildDbWithEmployeeLookup(NEW_RESUME_ROW, EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await createResume(db, consultantUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to create a resume for a different employee", async () => {
    // Consultant maps to EMPLOYEE_ID_1 but input.employeeId is EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(NEW_RESUME_ROW, EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await expect(
      createResume(db, consultantUser, {
        employeeId: EMPLOYEE_ID_2,
        title: "Hack Attempt",
        language: "en",
        summary: null,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("succeeds for a consultant with no employee record (no ownership restriction)", async () => {
    // resolveEmployeeId returns null when no employee matches → no restriction
    const { db } = buildInsertMock({ ...NEW_RESUME_ROW, title: "Ghost Resume" });
    // Override selectFrom so employees lookup returns undefined
    const realSelectFrom = (db as unknown as { selectFrom: ReturnType<typeof vi.fn> }).selectFrom;
    realSelectFrom.mockImplementation((table: string) => {
      if (table === "employees") {
        return { select: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }) }) };
      }
      return realSelectFrom.getMockImplementation()!(table);
    });
    const consultantUser = { role: "consultant" as const, email: "ghost@example.com" };

    const result = await createResume(db, consultantUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "Ghost Resume",
      language: "en",
      summary: null,
    });
    expect(result.title).toBe("Ghost Resume");
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildInsertMock(NEW_RESUME_ROW);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await createResume(db, adminUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: false,
      createdAt: NEW_RESUME_ROW.created_at,
      updatedAt: NEW_RESUME_ROW.updated_at,
    });
    expect(result).not.toHaveProperty("employee_id");
  });
});

// ---------------------------------------------------------------------------
// Tests: createCreateResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createCreateResumeHandler", () => {
  it("creates a resume for authenticated admin", async () => {
    const { db } = buildInsertMock(NEW_RESUME_ROW);
    const handler = createCreateResumeHandler(db);

    const result = await call(
      handler,
      { employeeId: EMPLOYEE_ID_1, title: "New Backend Resume", language: "en" },
      { context: { user: { role: "admin", email: "admin@example.com" } } }
    );

    expect(result.id).toBe(RESUME_ID);
    expect(result.skills).toEqual([]);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildInsertMock(NEW_RESUME_ROW);
    const handler = createCreateResumeHandler(db);

    await expect(
      call(
        handler,
        { employeeId: EMPLOYEE_ID_1, title: "New Resume", language: "en" },
        { context: {} }
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
