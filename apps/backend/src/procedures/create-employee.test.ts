import { describe, it, expect, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createEmployee } from "./create-employee.js";

// ---------------------------------------------------------------------------
// Unit tests for the createEmployee procedure handler.
//
// A mock Kysely instance is injected directly into the `createEmployee`
// function so no real database connection or vi.mock() on module imports is
// required.
// ---------------------------------------------------------------------------

const FIXED_NEW_EMPLOYEE = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "Alice",
  email: "alice@example.com",
  created_at: new Date("2025-02-01T00:00:00.000Z"),
  updated_at: new Date("2025-02-01T00:00:00.000Z"),
};

/** Build a mock Kysely instance that fakes the fluent INSERT chain. */
function buildInsertMock(row: unknown) {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = vi.fn().mockReturnValue({ returningAll });
  const insertInto = vi.fn().mockReturnValue({ values });
  const db = { insertInto } as unknown as Kysely<Database>;
  return { db, insertInto, values, returningAll, executeTakeFirstOrThrow };
}

describe("createEmployee", () => {
  it("returns the created employee when the db returns the new row", async () => {
    // Arrange
    const { db } = buildInsertMock(FIXED_NEW_EMPLOYEE);

    // Act
    const result = await createEmployee(
      db,
      FIXED_NEW_EMPLOYEE.name,
      FIXED_NEW_EMPLOYEE.email
    );

    // Assert
    expect(result).toEqual({
      id: FIXED_NEW_EMPLOYEE.id,
      name: FIXED_NEW_EMPLOYEE.name,
      email: FIXED_NEW_EMPLOYEE.email,
      createdAt: FIXED_NEW_EMPLOYEE.created_at,
      updatedAt: FIXED_NEW_EMPLOYEE.updated_at,
    });
  });

  it("calls insertInto with the correct name and email values", async () => {
    // Arrange
    const { db, values } = buildInsertMock(FIXED_NEW_EMPLOYEE);

    // Act
    await createEmployee(db, "Alice", "alice@example.com");

    // Assert — spy confirms the insert was called with the expected values
    expect(values).toHaveBeenCalledWith({
      name: "Alice",
      email: "alice@example.com",
    });
  });
});
