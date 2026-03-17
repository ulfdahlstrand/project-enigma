import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createDeleteCVHandler, deleteCV } from "./delete-cv.js";

// ---------------------------------------------------------------------------
// Unit tests for the deleteCV procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const CV_ID = "550e8400-e29b-41d4-a716-446655440021";

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance for the deleteCV flow:
 *   - selectFrom("cvs") for ownership lookup
 *   - deleteFrom("cvs") for the actual delete
 */
function buildDeleteMock(cvLookupRow: unknown, deletedRow: unknown) {
  // Ownership lookup
  const cvLookupExecuteTakeFirst = vi.fn().mockResolvedValue(cvLookupRow);
  const cvLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvLookupExecuteTakeFirst });
  const cvLookupSelect = vi.fn().mockReturnValue({ where: cvLookupWhere });

  // DELETE chain
  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const deleteWhere = vi.fn().mockReturnValue({ returning });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "cvs") return { select: cvLookupSelect };
    return {};
  });

  const db = { deleteFrom, selectFrom } as unknown as Kysely<Database>;
  return { db, deleteFrom, deleteWhere, returning, executeTakeFirst, cvLookupExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup for consultant auth. */
function buildDbWithEmployeeLookup(
  cvLookupRow: unknown,
  deletedRow: unknown,
  employeeId: string
) {
  const cvLookupExecuteTakeFirst = vi.fn().mockResolvedValue(cvLookupRow);
  const cvLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvLookupExecuteTakeFirst });
  const cvLookupSelect = vi.fn().mockReturnValue({ where: cvLookupWhere });

  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const deleteWhere = vi.fn().mockReturnValue({ returning });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "cvs") return { select: cvLookupSelect };
    return {};
  });

  const db = { deleteFrom, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: deleteCV query function
// ---------------------------------------------------------------------------

describe("deleteCV query function", () => {
  it("admin deletes any CV and returns { deleted: true }", async () => {
    const { db, deleteFrom } = buildDeleteMock(
      { employee_id: EMPLOYEE_ID_1 },
      { id: CV_ID }
    );
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await deleteCV(db, adminUser, CV_ID);

    expect(result).toEqual({ deleted: true });
    expect(deleteFrom).toHaveBeenCalledWith("cvs");
  });

  it("consultant deletes their own CV successfully", async () => {
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      { id: CV_ID },
      EMPLOYEE_ID_1
    );
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await deleteCV(db, consultantUser, CV_ID);

    expect(result).toEqual({ deleted: true });
  });

  it("throws FORBIDDEN when consultant tries to delete another employee's CV", async () => {
    // CV belongs to EMPLOYEE_ID_1, consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      { id: CV_ID },
      EMPLOYEE_ID_2
    );
    const consultantUser = { role: "consultant" as const, email: "other@example.com" };

    await expect(deleteCV(db, consultantUser, CV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("throws NOT_FOUND when the CV does not exist (delete returns undefined)", async () => {
    const { db } = buildDeleteMock({ employee_id: EMPLOYEE_ID_1 }, undefined);
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    await expect(deleteCV(db, adminUser, CV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws NOT_FOUND when the CV lookup returns undefined for consultant", async () => {
    // Simulate a case where the CV doesn't exist at all during ownership check
    const { db } = buildDbWithEmployeeLookup(
      undefined, // CV not found during lookup
      undefined,
      EMPLOYEE_ID_1
    );
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    await expect(deleteCV(db, consultantUser, CV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: createDeleteCVHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createDeleteCVHandler", () => {
  it("deletes a CV for authenticated admin", async () => {
    const { db } = buildDeleteMock(
      { employee_id: EMPLOYEE_ID_1 },
      { id: CV_ID }
    );
    const handler = createDeleteCVHandler(db);

    const result = await call(
      handler,
      { id: CV_ID },
      { context: { user: { role: "admin", email: "admin@example.com" } } }
    );

    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDeleteMock({ employee_id: EMPLOYEE_ID_1 }, { id: CV_ID });
    const handler = createDeleteCVHandler(db);

    await expect(
      call(handler, { id: CV_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
