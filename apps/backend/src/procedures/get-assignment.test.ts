import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createGetAssignmentHandler, getAssignment } from "./get-assignment.js";

const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";
const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";

const ASSIGNMENT_ROW = {
  id: ASSIGN_ID,
  employee_id: EMP_ID,
  resume_id: null,
  client_name: "Acme Corp",
  role: "Senior Developer",
  description: "Built things",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["TypeScript"],
  is_current: false,
  keywords: null,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
  updated_at: new Date("2023-01-01T00:00:00.000Z"),
};

function buildDb(row: unknown | undefined) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const selectAll = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  return { selectFrom } as unknown as Kysely<Database>;
}

describe("getAssignment query function", () => {
  it("returns the assignment when found", async () => {
    const db = buildDb(ASSIGNMENT_ROW);
    const result = await getAssignment(db, ASSIGN_ID);
    expect(result).toMatchObject({ id: ASSIGN_ID, clientName: "Acme Corp" });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const db = buildDb(undefined);
    await expect(getAssignment(db, ASSIGN_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

describe("createGetAssignmentHandler", () => {
  it("returns assignment for authenticated user", async () => {
    const db = buildDb(ASSIGNMENT_ROW);
    const handler = createGetAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGN_ID }, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toMatchObject({ id: ASSIGN_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(ASSIGNMENT_ROW);
    const handler = createGetAssignmentHandler(db);
    await expect(call(handler, { id: ASSIGN_ID }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
