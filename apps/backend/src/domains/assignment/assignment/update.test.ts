import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createUpdateAssignmentHandler, updateAssignment } from "./update.js";

const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";
const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";

const UPDATED_ROW = {
  id: ASSIGN_ID,
  employee_id: EMP_ID,
  resume_id: null,
  client_name: "New Client",
  role: "Lead Developer",
  description: "Updated",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["Go"],
  is_current: true,
  keywords: null,
  type: null,
  highlight: false,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
  updated_at: new Date("2023-06-01T00:00:00.000Z"),
};

function buildDb(row: unknown | undefined) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirst });
  const where = vi.fn().mockReturnValue({ returningAll });
  const set = vi.fn().mockReturnValue({ where });
  const updateTable = vi.fn().mockReturnValue({ set });
  return { updateTable } as unknown as Kysely<Database>;
}

describe("updateAssignment query function", () => {
  it("updates and returns the assignment", async () => {
    const db = buildDb(UPDATED_ROW);
    const result = await updateAssignment(db, { id: ASSIGN_ID, clientName: "New Client" });
    expect(result).toMatchObject({ id: ASSIGN_ID, clientName: "New Client" });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const db = buildDb(undefined);
    await expect(updateAssignment(db, { id: ASSIGN_ID, role: "Dev" })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

describe("createUpdateAssignmentHandler", () => {
  it("updates when authenticated", async () => {
    const db = buildDb(UPDATED_ROW);
    const handler = createUpdateAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGN_ID, role: "Lead" }, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toMatchObject({ id: ASSIGN_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(UPDATED_ROW);
    const handler = createUpdateAssignmentHandler(db);
    await expect(call(handler, { id: ASSIGN_ID, role: "Dev" }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
