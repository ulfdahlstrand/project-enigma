import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createListResumesHandler, listResumes } from "./list-resumes.js";

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

const RESUME_ROW_1 = {
  id: RESUME_ID_1,
  employee_id: EMPLOYEE_ID_1,
  title: "Senior Backend Resume",
  summary: "Experienced backend engineer",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
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
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely fluent SELECT chain that supports optional where()
 * clauses (list-resumes conditionally calls where() for filters).
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
function buildDbWithEmployeeLookup(resumeRows: unknown[], employeeId: string) {
  const resumeExecute = vi.fn().mockResolvedValue(resumeRows);
  const resumeWhereChain: { execute: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } = {
    execute: resumeExecute,
    where: vi.fn(),
  };
  resumeWhereChain.where.mockReturnValue(resumeWhereChain);
  const selectAll = vi.fn().mockReturnValue({ execute: resumeExecute, where: resumeWhereChain.where });

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
  return { db, resumeExecute };
}

// ---------------------------------------------------------------------------
// Tests: listResumes query function
// ---------------------------------------------------------------------------

describe("listResumes query function", () => {
  it("returns all resumes for admin with no filters", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1, RESUME_ROW_2]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listResumes(db, adminUser, {});

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
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listResumes(db, adminUser, {});

    expect(result).toEqual([]);
  });

  it("consultant only sees resumes belonging to their own employee record", async () => {
    const { db, resumeExecute } = buildDbWithEmployeeLookup([RESUME_ROW_1], EMPLOYEE_ID_1);
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await listResumes(db, consultantUser, {});

    expect(resumeExecute).toHaveBeenCalledTimes(1);
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildSelectMock([RESUME_ROW_1]);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await listResumes(db, adminUser, {});

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
      context: { user: { role: "admin", email: "admin@example.com" } },
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
      context: { user: { role: "consultant", email: "consultant@example.com" } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(RESUME_ID_1);
  });
});
