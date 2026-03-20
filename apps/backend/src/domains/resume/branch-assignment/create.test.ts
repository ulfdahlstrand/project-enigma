import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createAssignment, createCreateAssignmentHandler } from "./create.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";
const BA_ID = "550e8400-e29b-41d4-a716-446655440061";

const VALID_INPUT = {
  employeeId: EMP_ID,
  branchId: BRANCH_ID,
  clientName: "Acme Corp",
  role: "Developer",
  description: "Built things",
  startDate: "2023-01-01",
  endDate: null,
  technologies: ["TypeScript"],
  isCurrent: false,
  keywords: null,
  type: null,
  highlight: false,
};

const IDENTITY_ROW = { id: ASSIGNMENT_ID, employee_id: EMP_ID, created_at: new Date() };

const BA_ROW = {
  id: BA_ID,
  branch_id: BRANCH_ID,
  assignment_id: ASSIGNMENT_ID,
  client_name: "Acme Corp",
  role: "Developer",
  description: "Built things",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["TypeScript"],
  is_current: false,
  keywords: null,
  type: null,
  highlight: false,
  sort_order: null,
  created_at: new Date("2023-01-01"),
  updated_at: new Date("2023-01-01"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDb() {
  // Two inserts in transaction: assignments identity, then branch_assignments content
  const identityExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(IDENTITY_ROW);
  const identityReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: identityExecuteTakeFirstOrThrow });
  const identityValues = vi.fn().mockReturnValue({ returningAll: identityReturningAll });

  const baExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(BA_ROW);
  const baReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: baExecuteTakeFirstOrThrow });
  const baValues = vi.fn().mockReturnValue({ returningAll: baReturningAll });

  let insertCallCount = 0;
  const insertInto = vi.fn().mockImplementation(() => {
    insertCallCount++;
    return insertCallCount === 1
      ? { values: identityValues }
      : { values: baValues };
  });

  const db = {
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => fn({ insertInto })),
    }),
    insertInto,
  } as unknown as Kysely<Database>;

  return { db, identityValues, baValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAssignment", () => {
  it("inserts identity then branch_assignments in a transaction", async () => {
    const { db, identityValues, baValues } = buildDb();

    const result = await createAssignment(db, VALID_INPUT);

    expect(identityValues).toHaveBeenCalledWith({ employee_id: EMP_ID });
    expect(baValues).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: BRANCH_ID,
        assignment_id: ASSIGNMENT_ID,
        client_name: "Acme Corp",
        role: "Developer",
      })
    );
    expect(result.id).toBe(BA_ID);
    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
    expect(result.branchId).toBe(BRANCH_ID);
    expect(result.employeeId).toBe(EMP_ID);
  });

  it("returns full content fields from branch_assignments row", async () => {
    const { db } = buildDb();
    const result = await createAssignment(db, VALID_INPUT);
    expect(result.clientName).toBe("Acme Corp");
    expect(result.role).toBe("Developer");
    expect(result.technologies).toEqual(["TypeScript"]);
  });
});

describe("createCreateAssignmentHandler", () => {
  it("returns result when authenticated", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db as unknown as Kysely<Database>);
    const result = await call(handler, VALID_INPUT, {
      context: { user: { role: "admin", email: "a@example.com" } },
    });
    expect(result.assignmentId).toBeDefined();
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db as unknown as Kysely<Database>);
    await expect(
      call(handler, VALID_INPUT, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
