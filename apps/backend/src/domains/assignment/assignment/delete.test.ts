import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createDeleteAssignmentHandler, deleteAssignment } from "./delete.js";

const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";

function buildDb(row: unknown | undefined) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const where = vi.fn().mockReturnValue({ returningAll });
  const deleteFrom = vi.fn().mockReturnValue({ where });
  return { deleteFrom } as unknown as Kysely<Database>;
}

describe("deleteAssignment query function", () => {
  it("returns { deleted: true } on success", async () => {
    const db = buildDb({ id: ASSIGN_ID });
    const result = await deleteAssignment(db, ASSIGN_ID);
    expect(result).toEqual({ deleted: true });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const db = buildDb(undefined);
    await expect(deleteAssignment(db, ASSIGN_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

describe("createDeleteAssignmentHandler", () => {
  it("deletes when authenticated", async () => {
    const db = buildDb({ id: ASSIGN_ID });
    const handler = createDeleteAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGN_ID }, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb({ id: ASSIGN_ID });
    const handler = createDeleteAssignmentHandler(db);
    await expect(call(handler, { id: ASSIGN_ID }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
