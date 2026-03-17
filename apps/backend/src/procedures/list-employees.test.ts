import { describe, it, expect, vi } from "vitest";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createListEmployeesHandler } from "./list-employees.js";

// ---------------------------------------------------------------------------
// Unit tests for the listEmployees procedure handler.
//
// Uses oRPC's public `call()` helper to invoke the procedure — this is the
// correct integration point and avoids reliance on internal `~orpc` fields.
//
// A mock Kysely instance is injected via `createListEmployeesHandler(db)` so
// no real database connection is required.
// ---------------------------------------------------------------------------

/** Build a mock Kysely instance that fakes the fluent query chain. */
function buildDbMock(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const selectAll = vi.fn().mockReturnValue({ execute });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, selectAll, execute };
}

describe("listEmployees procedure", () => {
  it("calls db.selectFrom('employees').selectAll().execute() and returns the rows", async () => {
    // Arrange
    const mockRows = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Alice Smith",
        email: "alice@example.com",
        created_at: new Date("2025-01-01T00:00:00.000Z"),
        updated_at: new Date("2025-01-01T00:00:00.000Z"),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "Bob Jones",
        email: "bob@example.com",
        created_at: new Date("2025-01-02T00:00:00.000Z"),
        updated_at: new Date("2025-01-02T00:00:00.000Z"),
      },
    ];

    const { db, selectFrom, selectAll, execute } = buildDbMock(mockRows);
    const handler = createListEmployeesHandler(db);

    // Act — use the public oRPC `call()` helper to invoke the procedure.
    // Input is {} because the contract declares `oc.input(z.object({}))`.
    const result = await call(handler, {});

    // Assert: correct Kysely fluent chain was invoked
    expect(selectFrom).toHaveBeenCalledWith("employees");
    expect(selectAll).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);

    // Assert: the resolved value equals the mock rows
    expect(result).toEqual(mockRows);
  });

  it("returns an empty array when there are no employees", async () => {
    // Arrange
    const { db, execute } = buildDbMock([]);
    const handler = createListEmployeesHandler(db);

    // Act
    const result = await call(handler, {});

    // Assert
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});
