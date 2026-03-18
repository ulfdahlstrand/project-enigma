import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { listBranchAssignments, createListBranchAssignmentsHandler } from "./list-branch-assignments.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const BA_ID = "550e8400-e29b-41d4-a716-446655440061";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const BRANCH_ROW = { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 };

const BA_ROW = {
  id: BA_ID,
  branch_id: BRANCH_ID,
  assignment_id: ASSIGNMENT_ID,
  highlight: true,
  sort_order: 0,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  baRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    baRows = [BA_ROW],
    employeeId = null,
  } = opts;

  const resolvedBranch = branchRow === null ? undefined : branchRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Branch ownership check — single innerJoin (resume_branches → resumes)
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin1 = vi.fn().mockReturnValue({ select: branchSelect });

  // Branch assignments list query
  const baExecute = vi.fn().mockResolvedValue(baRows);
  const baOrderBy = vi.fn().mockReturnValue({ execute: baExecute });
  const baWhere = vi.fn().mockReturnValue({ orderBy: baOrderBy });
  const baSelectAll = vi.fn().mockReturnValue({ where: baWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "branch_assignments") return { selectAll: baSelectAll };
    // resume_branches as rb join
    return { innerJoin: branchInnerJoin1 };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, baWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listBranchAssignments", () => {
  it("returns all assignments linked to the branch", async () => {
    const { db } = buildDbMock();

    const result = await listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: BA_ID,
      branchId: BRANCH_ID,
      assignmentId: ASSIGNMENT_ID,
      highlight: true,
      sortOrder: 0,
    });
  });

  it("returns empty array when no assignments are linked", async () => {
    const { db } = buildDbMock({ baRows: [] });

    const result = await listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can list their own branch assignments", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      listBranchAssignments(db, MOCK_CONSULTANT, { branchId: BRANCH_ID })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      listBranchAssignments(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createListBranchAssignmentsHandler", () => {
  it("calls listBranchAssignments with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createListBranchAssignmentsHandler(db);

    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toHaveLength(1);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListBranchAssignmentsHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
