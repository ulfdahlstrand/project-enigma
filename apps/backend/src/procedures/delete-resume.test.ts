import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createDeleteResumeHandler, deleteResume } from "./delete-resume.js";

// ---------------------------------------------------------------------------
// Unit tests for the deleteResume procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance for the deleteResume flow:
 *   - selectFrom("resumes") for ownership lookup
 *   - deleteFrom("resumes") for the actual delete
 */
function buildDeleteMock(resumeLookupRow: unknown, deletedRow: unknown) {
  // Ownership lookup
  const resumeLookupExecuteTakeFirst = vi.fn().mockResolvedValue(resumeLookupRow);
  const resumeLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeLookupExecuteTakeFirst });
  const resumeLookupSelect = vi.fn().mockReturnValue({ where: resumeLookupWhere });

  // DELETE chain
  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const deleteWhere = vi.fn().mockReturnValue({ returning });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resumes") return { select: resumeLookupSelect };
    return {};
  });

  const db = { deleteFrom, selectFrom } as unknown as Kysely<Database>;
  return { db, deleteFrom, deleteWhere, returning, executeTakeFirst, resumeLookupExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup for consultant auth. */
function buildDbWithEmployeeLookup(
  resumeLookupRow: unknown,
  deletedRow: unknown,
  employeeId: string
) {
  const resumeLookupExecuteTakeFirst = vi.fn().mockResolvedValue(resumeLookupRow);
  const resumeLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeLookupExecuteTakeFirst });
  const resumeLookupSelect = vi.fn().mockReturnValue({ where: resumeLookupWhere });

  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const deleteWhere = vi.fn().mockReturnValue({ returning });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resumes") return { select: resumeLookupSelect };
    return {};
  });

  const db = { deleteFrom, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: deleteResume query function
// ---------------------------------------------------------------------------

describe("deleteResume query function", () => {
  it("admin deletes any resume and returns { deleted: true }", async () => {
    const { db, deleteFrom } = buildDeleteMock(
      { employee_id: EMPLOYEE_ID_1 },
      { id: RESUME_ID }
    );
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await deleteResume(db, adminUser, RESUME_ID);

    expect(result).toEqual({ deleted: true });
    expect(deleteFrom).toHaveBeenCalledWith("resumes");
  });

  it("consultant deletes their own resume successfully", async () => {
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      { id: RESUME_ID },
      EMPLOYEE_ID_1
    );
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await deleteResume(db, consultantUser, RESUME_ID);

    expect(result).toEqual({ deleted: true });
  });

  it("throws FORBIDDEN when consultant tries to delete another employee's resume", async () => {
    // Resume belongs to EMPLOYEE_ID_1, consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      { id: RESUME_ID },
      EMPLOYEE_ID_2
    );
    const consultantUser = { role: "consultant" as const, email: "other@example.com" };

    await expect(deleteResume(db, consultantUser, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("throws NOT_FOUND when the resume does not exist (delete returns undefined)", async () => {
    const { db } = buildDeleteMock({ employee_id: EMPLOYEE_ID_1 }, undefined);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    await expect(deleteResume(db, adminUser, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws NOT_FOUND when the resume lookup returns undefined for consultant", async () => {
    // Simulate a case where the resume doesn't exist at all during ownership check
    const { db } = buildDbWithEmployeeLookup(
      undefined, // Resume not found during lookup
      undefined,
      EMPLOYEE_ID_1
    );
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await expect(deleteResume(db, consultantUser, RESUME_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createDeleteResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createDeleteResumeHandler", () => {
  it("deletes a resume for authenticated admin", async () => {
    const { db } = buildDeleteMock(
      { employee_id: EMPLOYEE_ID_1 },
      { id: RESUME_ID }
    );
    const handler = createDeleteResumeHandler(db);

    const result = await call(
      handler,
      { id: RESUME_ID },
      { context: { user: { role: "admin", email: "admin@example.com" } } }
    );

    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDeleteMock({ employee_id: EMPLOYEE_ID_1 }, { id: RESUME_ID });
    const handler = createDeleteResumeHandler(db);

    await expect(
      call(handler, { id: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
