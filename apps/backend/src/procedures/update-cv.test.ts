import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createUpdateCVHandler, updateCV } from "./update-cv.js";

// ---------------------------------------------------------------------------
// Unit tests for the updateCV procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const CV_ID = "550e8400-e29b-41d4-a716-446655440021";

const UPDATED_CV_ROW = {
  id: CV_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "Updated Backend CV",
  summary: "Updated summary",
  language: "en",
  is_main: true,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-04-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock that handles: optional CV lookup for ownership check +
 * the UPDATE chain.
 */
function buildUpdateMock(cvLookupRow: unknown, updatedRow: unknown) {
  // CV lookup (selectFrom cvs for ownership check)
  const cvLookupExecuteTakeFirst = vi.fn().mockResolvedValue(cvLookupRow);
  const cvLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvLookupExecuteTakeFirst });
  const cvLookupSelect = vi.fn().mockReturnValue({ where: cvLookupWhere });

  // UPDATE chain
  const executeTakeFirst = vi.fn().mockResolvedValue(updatedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const updateWhere = vi.fn().mockReturnValue({ returningAll });
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "cvs") return { select: cvLookupSelect };
    return {};
  });

  const db = { updateTable, selectFrom } as unknown as Kysely<Database>;
  return { db, updateTable, set, updateWhere, returningAll, executeTakeFirst, cvLookupExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(
  cvLookupRow: unknown,
  updatedRow: unknown,
  employeeId: string
) {
  const cvLookupExecuteTakeFirst = vi.fn().mockResolvedValue(cvLookupRow);
  const cvLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: cvLookupExecuteTakeFirst });
  const cvLookupSelect = vi.fn().mockReturnValue({ where: cvLookupWhere });

  const executeTakeFirst = vi.fn().mockResolvedValue(updatedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const updateWhere = vi.fn().mockReturnValue({ returningAll });
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "cvs") return { select: cvLookupSelect };
    return {};
  });

  const db = { updateTable, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: updateCV query function
// ---------------------------------------------------------------------------

describe("updateCV query function", () => {
  it("updates title only and returns the updated CV row", async () => {
    const { db, set } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_CV_ROW
    );
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await updateCV(db, adminUser, {
      id: CV_ID,
      title: "Updated Backend CV",
    });

    expect(result).toMatchObject({
      id: CV_ID,
      title: "Updated Backend CV",
      isMain: true,
    });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated Backend CV" }));
  });

  it("throws NOT_FOUND when the CV does not exist (update returns undefined)", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      undefined
    );
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    await expect(
      updateCV(db, adminUser, { id: CV_ID, title: "Ghost" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant updates their own CV successfully", async () => {
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_CV_ROW,
      EMPLOYEE_ID_1
    );
    const consultantUser = { role: "consultant" as const, email: "consultant@example.com" };

    const result = await updateCV(db, consultantUser, { id: CV_ID, title: "Updated" });

    expect(result.id).toBe(CV_ID);
  });

  it("throws FORBIDDEN when consultant tries to update another employee's CV", async () => {
    // CV belongs to EMPLOYEE_ID_1, consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_CV_ROW,
      EMPLOYEE_ID_2
    );
    const consultantUser = { role: "consultant" as const, email: "other@example.com" };

    await expect(
      updateCV(db, consultantUser, { id: CV_ID, title: "Hack" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_CV_ROW
    );
    const adminUser = { role: "admin" as const, email: "admin@example.com" };

    const result = await updateCV(db, adminUser, { id: CV_ID, title: "Updated" });

    expect(result).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: true,
      createdAt: UPDATED_CV_ROW.created_at,
      updatedAt: UPDATED_CV_ROW.updated_at,
    });
    expect(result).not.toHaveProperty("employee_id");
    expect(result).not.toHaveProperty("is_main");
  });
});

// ---------------------------------------------------------------------------
// Tests: createUpdateCVHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createUpdateCVHandler", () => {
  it("updates a CV for authenticated admin", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_CV_ROW
    );
    const handler = createUpdateCVHandler(db);

    const result = await call(
      handler,
      { id: CV_ID, title: "Updated Backend CV" },
      { context: { user: { role: "admin", email: "admin@example.com" } } }
    );

    expect(result.id).toBe(CV_ID);
    expect(result.title).toBe("Updated Backend CV");
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildUpdateMock({ employee_id: EMPLOYEE_ID_1 }, UPDATED_CV_ROW);
    const handler = createUpdateCVHandler(db);

    await expect(
      call(handler, { id: CV_ID, title: "Updated" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
