import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createCreateCVHandler, createCV } from "./create-cv.js";

// ---------------------------------------------------------------------------
// Unit tests for the createCV procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const CV_ID = "550e8400-e29b-41d4-a716-446655440021";

const NEW_CV_ROW = {
  id: CV_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "New Backend CV",
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
 * Builds a mock Kysely instance that handles the CV insert and skills query
 * that createCV performs.
 */
function buildInsertMock(insertedRow: unknown) {
  // Skills query (returns empty array since newly created CVs have no skills)
  const skillsExecute = vi.fn().mockResolvedValue([]);
  const skillsOrderBy = vi.fn().mockReturnValue({ execute: skillsExecute });
  const skillsWhere = vi.fn().mockReturnValue({ orderBy: skillsOrderBy });
  const skillsSelectAll = vi.fn().mockReturnValue({ where: skillsWhere });

  // CV insert chain
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = vi.fn().mockReturnValue({ returningAll });
  const insertInto = vi.fn().mockReturnValue({ values });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "cv_skills") return { selectAll: skillsSelectAll };
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
    if (table === "cv_skills") return { selectAll: skillsSelectAll };
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
// Tests: createCV query function
// ---------------------------------------------------------------------------

describe("createCV query function", () => {
  it("admin creates CV for any employee and returns CV with empty skills array", async () => {
    const { db, values } = buildInsertMock(NEW_CV_ROW);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await createCV(db, adminUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend CV",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      id: CV_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend CV",
    });
    expect(result.skills).toEqual([]);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: EMPLOYEE_ID_1,
        title: "New Backend CV",
        language: "en",
      })
    );
  });

  it("consultant creates CV for their own employee_id and succeeds", async () => {
    const { db } = buildDbWithEmployeeLookup(NEW_CV_ROW, EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await createCV(db, consultantUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend CV",
      language: "en",
      summary: null,
    });

    expect(result.id).toBe(CV_ID);
  });

  it("throws FORBIDDEN when consultant tries to create a CV for a different employee", async () => {
    // Consultant maps to EMPLOYEE_ID_1 but input.employeeId is EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(NEW_CV_ROW, EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await expect(
      createCV(db, consultantUser, {
        employeeId: EMPLOYEE_ID_2,
        title: "Hack Attempt",
        language: "en",
        summary: null,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("throws FORBIDDEN when consultant has no employee record", async () => {
    const { db } = buildDbWithMissingEmployee();
    const consultantUser = { role: "consultant" as const, email: "ghost@example.com" };

    await expect(
      createCV(db, consultantUser, {
        employeeId: EMPLOYEE_ID_1,
        title: "Ghost CV",
        language: "en",
        summary: null,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildInsertMock(NEW_CV_ROW);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await createCV(db, adminUser, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend CV",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: false,
      createdAt: NEW_CV_ROW.created_at,
      updatedAt: NEW_CV_ROW.updated_at,
    });
    expect(result).not.toHaveProperty("employee_id");
  });
});

// ---------------------------------------------------------------------------
// Tests: createCreateCVHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createCreateCVHandler", () => {
  it("creates a CV for authenticated admin", async () => {
    const { db } = buildInsertMock(NEW_CV_ROW);
    const handler = createCreateCVHandler(db);

    const result = await call(
      handler,
      { employeeId: EMPLOYEE_ID_1, title: "New Backend CV", language: "en" },
      { context: { user: { role: "admin", email: "admin@example.com" } } }
    );

    expect(result.id).toBe(CV_ID);
    expect(result.skills).toEqual([]);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildInsertMock(NEW_CV_ROW);
    const handler = createCreateCVHandler(db);

    await expect(
      call(
        handler,
        { employeeId: EMPLOYEE_ID_1, title: "New CV", language: "en" },
        { context: {} }
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
