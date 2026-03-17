import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getEmployee } from "./get-employee.js";

// ---------------------------------------------------------------------------
// Unit tests for the getEmployee procedure handler.
//
// A mock Kysely instance is injected directly into the `getEmployee` function
// so no real database connection or vi.mock() on module imports is required.
// ---------------------------------------------------------------------------

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440001";

const FIXED_EMPLOYEE = {
  id: VALID_UUID,
  name: "Alice Smith",
  email: "alice@example.com",
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
};

/** Build a mock Kysely instance that fakes the fluent SELECT chain. */
function buildSelectMock(row: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const selectAll = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, selectAll, where, executeTakeFirst };
}

describe("getEmployee", () => {
  it("returns the employee when the db returns a matching row", async () => {
    // Arrange
    const { db } = buildSelectMock(FIXED_EMPLOYEE);

    // Act
    const result = await getEmployee(db, VALID_UUID);

    // Assert
    expect(result).toEqual({
      id: FIXED_EMPLOYEE.id,
      name: FIXED_EMPLOYEE.name,
      email: FIXED_EMPLOYEE.email,
      createdAt: FIXED_EMPLOYEE.created_at,
      updatedAt: FIXED_EMPLOYEE.updated_at,
    });
  });

  it("throws ORPCError with code NOT_FOUND when the db returns undefined", async () => {
    // Arrange
    const { db } = buildSelectMock(undefined);

    // Act & Assert
    await expect(getEmployee(db, VALID_UUID)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});
