import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createListAssignmentsHandler, listAssignments } from "./list-assignments.js";

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const ASSIGN_ID = "550e8400-e29b-41d4-a716-446655440031";

const ASSIGNMENT_ROW = {
  id: ASSIGN_ID,
  employee_id: EMP_ID,
  resume_id: null,
  client_name: "Acme Corp",
  role: "Senior Developer",
  description: "Built stuff",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: ["TypeScript", "React"],
  is_current: true,
  created_at: new Date("2023-01-01T00:00:00.000Z"),
  updated_at: new Date("2023-01-01T00:00:00.000Z"),
};

function buildSelectMock(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const whereChain = { orderBy, where: vi.fn() };
  whereChain.where.mockReturnValue(whereChain);
  const selectAll = vi.fn().mockReturnValue({ orderBy, where: whereChain.where });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, execute };
}

function buildDbWithEmployeeLookup(assignRows: unknown[], employeeId: string) {
  const execute = vi.fn().mockResolvedValue(assignRows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const whereChain: { orderBy: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } = {
    orderBy,
    where: vi.fn(),
  };
  whereChain.where.mockReturnValue(whereChain);
  const selectAll = vi.fn().mockReturnValue({ orderBy, where: whereChain.where });

  const empExecuteTakeFirst = vi.fn().mockResolvedValue({ id: employeeId });
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { selectAll };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, execute };
}

describe("listAssignments query function", () => {
  it("returns all assignments for admin with no filters", async () => {
    const { db } = buildSelectMock([ASSIGNMENT_ROW]);
    const result = await listAssignments(db, { role: "admin", email: "admin@example.com" }, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: ASSIGN_ID,
      employeeId: EMP_ID,
      clientName: "Acme Corp",
      technologies: ["TypeScript", "React"],
    });
  });

  it("returns empty array when no assignments exist", async () => {
    const { db } = buildSelectMock([]);
    const result = await listAssignments(db, { role: "admin", email: "admin@example.com" }, {});
    expect(result).toEqual([]);
  });

  it("maps snake_case DB fields to camelCase", async () => {
    const { db } = buildSelectMock([ASSIGNMENT_ROW]);
    const result = await listAssignments(db, { role: "admin", email: "admin@example.com" }, {});
    expect(result[0]).toMatchObject({ employeeId: EMP_ID, clientName: "Acme Corp", isCurrent: true });
    expect(result[0]).not.toHaveProperty("employee_id");
    expect(result[0]).not.toHaveProperty("client_name");
  });

  it("consultant only sees own assignments", async () => {
    const { db, execute } = buildDbWithEmployeeLookup([ASSIGNMENT_ROW], EMP_ID);
    await listAssignments(db, { role: "consultant", email: "c@example.com" }, {});
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("createListAssignmentsHandler", () => {
  it("returns assignments for admin", async () => {
    const { db } = buildSelectMock([ASSIGNMENT_ROW]);
    const handler = createListAssignmentsHandler(db);
    const result = await call(handler, {}, { context: { user: { role: "admin", email: "a@example.com" } } });
    expect(result).toHaveLength(1);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildSelectMock([]);
    const handler = createListAssignmentsHandler(db);
    await expect(call(handler, {}, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
