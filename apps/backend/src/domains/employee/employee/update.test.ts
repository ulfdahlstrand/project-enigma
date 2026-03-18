import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { updateEmployee } from "./update.js";

// ---------------------------------------------------------------------------
// Unit tests for the updateEmployee procedure handler.
//
// A mock Kysely instance is injected directly into the `updateEmployee`
// function so no real database connection or vi.mock() on module imports is
// required.
// ---------------------------------------------------------------------------

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440003";

const FIXED_UPDATED_EMPLOYEE = {
  id: VALID_UUID,
  name: "Alice Updated",
  email: "alice-updated@example.com",
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-03-01T00:00:00.000Z"),
};

/** Build a mock Kysely instance that fakes the fluent UPDATE chain. */
function buildUpdateMock(row: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const where = vi.fn().mockReturnValue({ returningAll });
  const set = vi.fn().mockReturnValue({ where });
  const updateTable = vi.fn().mockReturnValue({ set });
  const db = { updateTable } as unknown as Kysely<Database>;
  return { db, updateTable, set, where, returningAll, executeTakeFirst };
}

describe("updateEmployee", () => {
  it("returns the updated employee when the db returns the updated row", async () => {
    // Arrange
    const { db } = buildUpdateMock(FIXED_UPDATED_EMPLOYEE);

    // Act
    const result = await updateEmployee(db, VALID_UUID, {
      name: FIXED_UPDATED_EMPLOYEE.name,
      email: FIXED_UPDATED_EMPLOYEE.email,
    });

    // Assert
    expect(result).toEqual({
      id: FIXED_UPDATED_EMPLOYEE.id,
      name: FIXED_UPDATED_EMPLOYEE.name,
      email: FIXED_UPDATED_EMPLOYEE.email,
      createdAt: FIXED_UPDATED_EMPLOYEE.created_at,
      updatedAt: FIXED_UPDATED_EMPLOYEE.updated_at,
    });
  });

  it("throws ORPCError with code NOT_FOUND when the db returns undefined", async () => {
    // Arrange
    const { db } = buildUpdateMock(undefined);

    // Act & Assert
    await expect(
      updateEmployee(db, VALID_UUID, { name: "Alice" })
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});
