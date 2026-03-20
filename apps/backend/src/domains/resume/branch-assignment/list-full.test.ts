import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listBranchAssignmentsFull, createListBranchAssignmentsFullHandler } from "./list-full.js";

const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440001";
const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440002";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440009";
const ASSIGNMENT_ID_1 = "550e8400-e29b-41d4-a716-446655440010";
const ASSIGNMENT_ID_2 = "550e8400-e29b-41d4-a716-446655440011";
const USER = { id: "550e8400-e29b-41d4-a716-446655440099", role: "admin" as const, email: "a@example.com" };

const BRANCH_ROW = { id: BRANCH_ID, employee_id: EMPLOYEE_ID };

const ASSIGNMENT_ROWS = [
  {
    id: ASSIGNMENT_ID_1,
    assignment_id: "550e8400-e29b-41d4-a716-446655440020",
    branch_id: BRANCH_ID,
    employee_id: EMPLOYEE_ID,
    client_name: "ACME",
    role: "Engineer",
    description: "Built things",
    start_date: new Date("2023-01-01"),
    end_date: null,
    technologies: ["TypeScript"],
    is_current: true,
    keywords: null,
    type: null,
    highlight: true,
    sort_order: 0,
    created_at: new Date("2023-01-01"),
    updated_at: new Date("2023-01-01"),
  },
  {
    id: ASSIGNMENT_ID_2,
    assignment_id: "550e8400-e29b-41d4-a716-446655440021",
    branch_id: BRANCH_ID,
    employee_id: EMPLOYEE_ID,
    client_name: "Globex",
    role: "Consultant",
    description: "",
    start_date: new Date("2022-01-01"),
    end_date: new Date("2022-12-31"),
    technologies: [],
    is_current: false,
    keywords: null,
    type: null,
    highlight: false,
    sort_order: 1,
    created_at: new Date("2022-01-01"),
    updated_at: new Date("2022-01-01"),
  },
];

function buildDb(opts: {
  branchRow?: unknown;
  assignmentRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const { branchRow = BRANCH_ROW, assignmentRows = ASSIGNMENT_ROWS, employeeId = null } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(branchRow === null ? undefined : branchRow);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  const assignmentsExecute = vi.fn().mockResolvedValue(assignmentRows);
  const assignmentsOrderBy2 = vi.fn().mockReturnValue({ execute: assignmentsExecute });
  const assignmentsOrderBy1 = vi.fn().mockReturnValue({ orderBy: assignmentsOrderBy2 });
  const assignmentsWhere = vi.fn().mockReturnValue({ orderBy: assignmentsOrderBy1 });
  const assignmentsSelect = vi.fn().mockReturnValue({ where: assignmentsWhere });
  const assignmentsInnerJoin = vi.fn().mockReturnValue({ select: assignmentsSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "branch_assignments as ba") return { innerJoin: assignmentsInnerJoin };
    return { innerJoin: branchInnerJoin };
  });

  return { selectFrom } as unknown as Kysely<Database>;
}

describe("listBranchAssignmentsFull", () => {
  it("returns full assignment data for all linked assignments", async () => {
    const db = buildDb();
    const result = await listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: ASSIGNMENT_ID_1,
      clientName: "ACME",
      role: "Engineer",
      isCurrent: true,
      highlight: true,
      sortOrder: 0,
    });
    expect(result[1]).toMatchObject({
      id: ASSIGNMENT_ID_2,
      clientName: "Globex",
      isCurrent: false,
      sortOrder: 1,
    });
  });

  it("returns empty array when branch has no assignments", async () => {
    const db = buildDb({ assignmentRows: [] });
    const result = await listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID });
    expect(result).toHaveLength(0);
  });

  it("maps snake_case to camelCase", async () => {
    const db = buildDb();
    const result = await listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID });
    expect(result[0]).not.toHaveProperty("client_name");
    expect(result[0]).toHaveProperty("clientName");
    expect(result[0]).not.toHaveProperty("is_current");
    expect(result[0]).toHaveProperty("isCurrent");
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const db = buildDb({ branchRow: null });
    await expect(
      listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const consultant = { id: "550e8400-e29b-41d4-a716-446655440088", role: "consultant" as const, email: "c@example.com" };
    const db = buildDb({ employeeId: EMPLOYEE_ID_2 });
    await expect(
      listBranchAssignmentsFull(db, consultant, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createListBranchAssignmentsFullHandler", () => {
  it("returns assignments when authenticated", async () => {
    const db = buildDb();
    const handler = createListBranchAssignmentsFullHandler(db);
    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: USER } });
    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb();
    const handler = createListBranchAssignmentsFullHandler(db);
    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
