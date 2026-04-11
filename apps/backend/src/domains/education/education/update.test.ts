import { describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { updateEducation } from "./update.js";

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440010";
const EDUCATION_ID = "550e8400-e29b-41d4-a716-446655440011";

const FIXED_ROW = {
  id: EDUCATION_ID,
  employee_id: EMPLOYEE_ID,
  type: "degree",
  value: "MSc Computer Science",
  sort_order: 2,
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-04-10T00:00:00.000Z"),
};

function buildUpdateMock(row: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const whereEmployee = vi.fn().mockReturnValue({ returningAll });
  const whereId = vi.fn().mockReturnValue({ where: whereEmployee });
  const set = vi.fn().mockReturnValue({ where: whereId });
  const updateTable = vi.fn().mockReturnValue({ set });
  const db = { updateTable } as unknown as Kysely<Database>;
  return { db, updateTable, set, whereId, whereEmployee };
}

describe("updateEducation", () => {
  it("updates an education row and maps it to contract shape", async () => {
    const { db, set, whereId, whereEmployee } = buildUpdateMock(FIXED_ROW);

    const result = await updateEducation(db, {
      employeeId: EMPLOYEE_ID,
      id: EDUCATION_ID,
      value: FIXED_ROW.value,
      sortOrder: FIXED_ROW.sort_order,
    });

    expect(set).toHaveBeenCalledWith({
      value: FIXED_ROW.value,
      sort_order: FIXED_ROW.sort_order,
    });
    expect(whereId).toHaveBeenCalledWith("id", "=", EDUCATION_ID);
    expect(whereEmployee).toHaveBeenCalledWith("employee_id", "=", EMPLOYEE_ID);
    expect(result).toEqual({
      id: EDUCATION_ID,
      employeeId: EMPLOYEE_ID,
      type: "degree",
      value: FIXED_ROW.value,
      sortOrder: FIXED_ROW.sort_order,
      createdAt: FIXED_ROW.created_at,
      updatedAt: FIXED_ROW.updated_at,
    });
  });

  it("throws NOT_FOUND when no education row matches", async () => {
    const { db } = buildUpdateMock(undefined);

    await expect(
      updateEducation(db, {
        employeeId: EMPLOYEE_ID,
        id: EDUCATION_ID,
        value: "Updated",
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });
});

