import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createCreateAssignmentHandler, createAssignment } from "./create-assignment.js";

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";

const RETURNED_ROW = {
  id: ASSIGN_ID,
  employee_id: EMP_ID,
  resume_id: null,
  client_name: "Acme Corp",
  role: "Developer",
  description: "",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["TypeScript"],
  is_current: false,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
  updated_at: new Date("2023-01-01T00:00:00.000Z"),
};

const VALID_INPUT = {
  employeeId: EMP_ID,
  clientName: "Acme Corp",
  role: "Developer",
  startDate: "2023-01-01",
  technologies: ["TypeScript"],
};

function buildDb(row: unknown) {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = vi.fn().mockReturnValue({ returningAll });
  const insertInto = vi.fn().mockReturnValue({ values });
  return { insertInto } as unknown as Kysely<Database>;
}

describe("createAssignment query function", () => {
  it("inserts and returns the new assignment", async () => {
    const db = buildDb(RETURNED_ROW);
    const result = await createAssignment(db, VALID_INPUT);
    expect(result).toMatchObject({ id: ASSIGN_ID, clientName: "Acme Corp" });
  });

  it("maps output to camelCase", async () => {
    const db = buildDb(RETURNED_ROW);
    const result = await createAssignment(db, VALID_INPUT);
    expect(result).not.toHaveProperty("client_name");
    expect(result).toHaveProperty("clientName");
  });
});

describe("createCreateAssignmentHandler", () => {
  it("creates assignment when authenticated", async () => {
    const db = buildDb(RETURNED_ROW);
    const handler = createCreateAssignmentHandler(db);
    const result = await call(handler, VALID_INPUT, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toMatchObject({ id: ASSIGN_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(RETURNED_ROW);
    const handler = createCreateAssignmentHandler(db);
    await expect(call(handler, VALID_INPUT, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
