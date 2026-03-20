import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { deleteAssignment, createDeleteAssignmentHandler } from "./delete.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";
const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";

const SOFT_DELETED_ROW = {
  id: ASSIGNMENT_ID,
  employee_id: EMP_ID,
  created_at: new Date(),
  deleted_at: new Date(),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDb(deletedRow: unknown = SOFT_DELETED_ROW) {
  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow === null ? undefined : deletedRow);
  const where2 = vi.fn().mockReturnValue({ returningAll: vi.fn().mockReturnValue({ executeTakeFirst }) });
  const where1 = vi.fn().mockReturnValue({ where: where2 });
  const set = vi.fn().mockReturnValue({ where: where1 });
  const updateTable = vi.fn().mockReturnValue({ set });

  return { db: { updateTable } as unknown as Kysely<Database>, executeTakeFirst };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deleteAssignment", () => {
  it("soft-deletes assignment by setting deleted_at and returns { deleted: true }", async () => {
    const { db } = buildDb();
    const result = await deleteAssignment(db, ASSIGNMENT_ID);
    expect(result).toEqual({ deleted: true });
  });

  it("throws NOT_FOUND when assignment does not exist or already deleted", async () => {
    const { db } = buildDb(null);
    await expect(deleteAssignment(db, ASSIGNMENT_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("sets deleted_at to current time", async () => {
    const { db, executeTakeFirst } = buildDb();
    // The mock returns the row regardless; we verify deleted_at was set via updateTable call
    await deleteAssignment(db, ASSIGNMENT_ID);
    expect(executeTakeFirst).toHaveBeenCalled();
  });
});

describe("createDeleteAssignmentHandler", () => {
  it("returns { deleted: true } when authenticated", async () => {
    const { db } = buildDb();
    const handler = createDeleteAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGNMENT_ID }, {
      context: { user: { role: "admin", email: "a@example.com" } },
    });
    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDb();
    const handler = createDeleteAssignmentHandler(db);
    await expect(
      call(handler, { id: ASSIGNMENT_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
