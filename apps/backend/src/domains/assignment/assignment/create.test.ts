import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createCreateAssignmentHandler, createAssignment } from "./create.js";

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440021";
const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";
const BA_ID = "550e8400-e29b-41d4-a716-446655440041";

const IDENTITY_ROW = {
  id: ASSIGN_ID,
  employee_id: EMP_ID,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
};

const BA_ROW = {
  id: BA_ID,
  branch_id: BRANCH_ID,
  assignment_id: ASSIGN_ID,
  client_name: "Acme Corp",
  role: "Developer",
  description: "",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["TypeScript"],
  is_current: false,
  keywords: null,
  type: null,
  highlight: false,
  sort_order: 0,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
  updated_at: new Date("2023-01-01T00:00:00.000Z"),
};

const VALID_INPUT = {
  employeeId: EMP_ID,
  branchId: BRANCH_ID,
  clientName: "Acme Corp",
  role: "Developer",
  startDate: "2023-01-01",
  description: "",
  isCurrent: false,
  highlight: false,
  technologies: ["TypeScript"],
};

function buildDb() {
  // assignments insert
  const assignExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(IDENTITY_ROW);
  const assignReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: assignExecuteTakeFirstOrThrow });
  const assignValues = vi.fn().mockReturnValue({ returningAll: assignReturningAll });

  // branch_assignments insert
  const baExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(BA_ROW);
  const baReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: baExecuteTakeFirstOrThrow });
  const baValues = vi.fn().mockReturnValue({ returningAll: baReturningAll });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "assignments") return { values: assignValues };
    return { values: baValues };
  });

  const transaction = vi.fn().mockReturnValue({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => fn({ insertInto })),
  });

  return { db: { transaction } as unknown as Kysely<Database> };
}

describe("createAssignment query function", () => {
  it("inserts identity and branch content, returns camelCase output", async () => {
    const { db } = buildDb();
    const result = await createAssignment(db, VALID_INPUT);
    expect(result).toMatchObject({
      id: BA_ID,
      assignmentId: ASSIGN_ID,
      branchId: BRANCH_ID,
      employeeId: EMP_ID,
      clientName: "Acme Corp",
      role: "Developer",
    });
  });

  it("does not expose snake_case fields", async () => {
    const { db } = buildDb();
    const result = await createAssignment(db, VALID_INPUT);
    expect(result).not.toHaveProperty("client_name");
    expect(result).toHaveProperty("clientName");
  });
});

describe("createCreateAssignmentHandler", () => {
  it("creates assignment when authenticated", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db);
    const result = await call(handler, VALID_INPUT, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toMatchObject({ id: BA_ID, assignmentId: ASSIGN_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db);
    await expect(call(handler, VALID_INPUT, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
