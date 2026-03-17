import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createListCVsHandler, listCVs } from "./list-cvs.js";

// ---------------------------------------------------------------------------
// Unit tests for the listCVs procedure.
//
// A mock Kysely instance is injected via the factory so no real database
// connection is required. The auth context is injected through call() options.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const CV_ID_1 = "550e8400-e29b-41d4-a716-446655440021";
const CV_ID_2 = "550e8400-e29b-41d4-a716-446655440022";

const CV_ROW_1 = {
  id: CV_ID_1,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Backend CV",
  summary: "Experienced backend engineer",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
};

const CV_ROW_2 = {
  id: CV_ID_2,
  employee_id: EMPLOYEE_ID_2,
  title: "Frontend Developer CV",
  summary: null,
  language: "sv",
  is_main: false,
  created_at: new Date("2025-02-01T00:00:00.000Z"),
  updated_at: new Date("2025-02-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely fluent SELECT chain that supports optional where()
 * clauses (list-cvs conditionally calls where() for filters).
 */
function buildSelectMock(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  // where() returns another chainable object ending in execute
  const whereChain = { execute, where: vi.fn() };
  whereChain.where.mockReturnValue(whereChain);
  const selectAll = vi.fn().mockReturnValue({ execute, where: whereChain.where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, selectAll, execute, where: whereChain.where };
}

/** Builds a mock for the employees lookup used by resolveEmployeeId. */
function buildDbWithEmployeeLookup(cvRows: unknown[], employeeId: string) {
  const cvExecute = vi.fn().mockResolvedValue(cvRows);
  const cvWhereChain: { execute: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } = {
    execute: cvExecute,
    where: vi.fn(),
  };
  cvWhereChain.where.mockReturnValue(cvWhereChain);
  const selectAll = vi.fn().mockReturnValue({ execute: cvExecute, where: cvWhereChain.where });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") {
      return { select: empSelect };
    }
    return { selectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, cvExecute };
}

// ---------------------------------------------------------------------------
// Tests: listCVs query function
// ---------------------------------------------------------------------------

describe("listCVs query function", () => {
  it("returns all CVs for admin with no filters", async () => {
    const { db } = buildSelectMock([CV_ROW_1, CV_ROW_2]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listCVs(db, adminUser, {});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: CV_ID_1,
      employeeId: EMPLOYEE_ID_1,
      title: "Senior Backend CV",
      isMain: true,
      language: "en",
    });
  });

  it("returns empty array when no CVs exist", async () => {
    const { db } = buildSelectMock([]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listCVs(db, adminUser, {});

    expect(result).toEqual([]);
  });

  it("consultant only sees CVs belonging to their own employee record", async () => {
    const { db, cvExecute } = buildDbWithEmployeeLookup([CV_ROW_1], EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await listCVs(db, consultantUser, {});

    expect(cvExecute).toHaveBeenCalledTimes(1);
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildSelectMock([CV_ROW_1]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listCVs(db, adminUser, {});

    expect(result[0]).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: true,
      createdAt: CV_ROW_1.created_at,
      updatedAt: CV_ROW_1.updated_at,
    });
    expect(result[0]).not.toHaveProperty("employee_id");
    expect(result[0]).not.toHaveProperty("is_main");
  });
});

// ---------------------------------------------------------------------------
// Tests: createListCVsHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createListCVsHandler", () => {
  it("returns all CVs when called by an admin", async () => {
    const { db } = buildSelectMock([CV_ROW_1, CV_ROW_2]);
    const handler = createListCVsHandler(db);

    const result = await call(handler, {}, {
      context: { user: { role: "admin", email: "admin@example.com" } },
    });

    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user is in context", async () => {
    const { db } = buildSelectMock([]);
    const handler = createListCVsHandler(db);

    await expect(
      call(handler, {}, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });

  it("consultant only sees own CVs (ignores employeeId input filter for ownership)", async () => {
    const { db } = buildDbWithEmployeeLookup([CV_ROW_1], EMPLOYEE_ID_1);
    const handler = createListCVsHandler(db);

    const result = await call(handler, {}, {
      context: { user: { role: "consultant", email: "consultant@example.com" } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(CV_ID_1);
  });
});
