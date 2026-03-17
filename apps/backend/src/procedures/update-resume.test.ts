import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createUpdateResumeHandler, updateResume } from "./update-resume.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Unit tests for the updateResume procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";

const UPDATED_RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "Updated Backend Resume",
  summary: "Updated summary",
  language: "en",
  is_main: true,
  consultant_title: null,
  presentation: [],
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-04-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

/**
 * Builds a mock that handles: optional resume lookup for ownership check +
 * the UPDATE chain.
 */
function buildUpdateMock(resumeLookupRow: unknown, updatedRow: unknown) {
  // Resume lookup (selectFrom resumes for ownership check)
  const resumeLookupExecuteTakeFirst = vi.fn().mockResolvedValue(resumeLookupRow);
  const resumeLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeLookupExecuteTakeFirst });
  const resumeLookupSelect = vi.fn().mockReturnValue({ where: resumeLookupWhere });

  // UPDATE chain
  const executeTakeFirst = vi.fn().mockResolvedValue(updatedRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const updateWhere = vi.fn().mockReturnValue({ returningAll });
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resumes") return { select: resumeLookupSelect };
    return {};
  });

  const db = { updateTable, selectFrom } as unknown as Kysely<Database>;
  return { db, updateTable, set, updateWhere, returningAll, executeTakeFirst, resumeLookupExecuteTakeFirst };
}

/** Builds a db mock that also handles the employee lookup (for consultant auth). */
function buildDbWithEmployeeLookup(
  resumeLookupRow: unknown,
  updatedRow: unknown,
  employeeId: string
) {
  const resumeLookupExecuteTakeFirst = vi.fn().mockResolvedValue(resumeLookupRow);
  const resumeLookupWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeLookupExecuteTakeFirst });
  const resumeLookupSelect = vi.fn().mockReturnValue({ where: resumeLookupWhere });

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
    if (table === "resumes") return { select: resumeLookupSelect };
    return {};
  });

  const db = { updateTable, selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests: updateResume query function
// ---------------------------------------------------------------------------

describe("updateResume query function", () => {
  it("updates title only and returns the updated resume row", async () => {
    const { db, set } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_RESUME_ROW
    );
    const result = await updateResume(db, MOCK_ADMIN, {
      id: RESUME_ID,
      title: "Updated Backend Resume",
    });

    expect(result).toMatchObject({
      id: RESUME_ID,
      title: "Updated Backend Resume",
      isMain: true,
    });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated Backend Resume" }));
  });

  it("throws NOT_FOUND when the resume does not exist (update returns undefined)", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      undefined
    );

    await expect(
      updateResume(db, MOCK_ADMIN, { id: RESUME_ID, title: "Ghost" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant updates their own resume successfully", async () => {
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_RESUME_ROW,
      EMPLOYEE_ID_1
    );
    const result = await updateResume(db, MOCK_CONSULTANT, { id: RESUME_ID, title: "Updated" });

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to update another employee's resume", async () => {
    // Resume belongs to EMPLOYEE_ID_1, consultant maps to EMPLOYEE_ID_2
    const { db } = buildDbWithEmployeeLookup(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_RESUME_ROW,
      EMPLOYEE_ID_2
    );
    await expect(
      updateResume(db, MOCK_CONSULTANT_2, { id: RESUME_ID, title: "Hack" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_RESUME_ROW
    );
    const result = await updateResume(db, MOCK_ADMIN, { id: RESUME_ID, title: "Updated" });

    expect(result).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: true,
      createdAt: UPDATED_RESUME_ROW.created_at,
      updatedAt: UPDATED_RESUME_ROW.updated_at,
    });
    expect(result).not.toHaveProperty("employee_id");
    expect(result).not.toHaveProperty("is_main");
  });
});

// ---------------------------------------------------------------------------
// Tests: createUpdateResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createUpdateResumeHandler", () => {
  it("updates a resume for authenticated admin", async () => {
    const { db } = buildUpdateMock(
      { employee_id: EMPLOYEE_ID_1 },
      UPDATED_RESUME_ROW
    );
    const handler = createUpdateResumeHandler(db);

    const result = await call(
      handler,
      { id: RESUME_ID, title: "Updated Backend Resume" },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(RESUME_ID);
    expect(result.title).toBe("Updated Backend Resume");
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildUpdateMock({ employee_id: EMPLOYEE_ID_1 }, UPDATED_RESUME_ROW);
    const handler = createUpdateResumeHandler(db);

    await expect(
      call(handler, { id: RESUME_ID, title: "Updated" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
