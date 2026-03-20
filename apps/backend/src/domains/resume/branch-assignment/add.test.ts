import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { addBranchAssignment, createAddBranchAssignmentHandler } from "./add.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const BA_ID = "550e8400-e29b-41d4-a716-446655440061";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const BRANCH_ROW = { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 };
const ASSIGNMENT_ROW = { employee_id: EMPLOYEE_ID_1 };

// Minimum valid input — required content fields after the branch-content refactor
const VALID_INPUT = {
  branchId: BRANCH_ID,
  assignmentId: ASSIGNMENT_ID,
  clientName: "Acme Corp",
  role: "Developer",
  startDate: "2023-01-01",
};

const INSERTED_ROW = {
  id: BA_ID,
  branch_id: BRANCH_ID,
  assignment_id: ASSIGNMENT_ID,
  client_name: "Acme Corp",
  role: "Developer",
  description: "",
  start_date: new Date("2023-01-01"),
  end_date: null,
  technologies: [],
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

function buildDbMock(opts: {
  branchRow?: unknown;
  assignmentRow?: unknown;
  insertedRow?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    assignmentRow = ASSIGNMENT_ROW,
    insertedRow = INSERTED_ROW,
    employeeId = null,
  } = opts;

  const resolvedBranch = branchRow === null ? undefined : branchRow;
  const resolvedAssignment = assignmentRow === null ? undefined : assignmentRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Branch ownership check — single innerJoin (resume_branches → resumes)
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin1 = vi.fn().mockReturnValue({ select: branchSelect });

  // Assignment cross-ownership check — two where calls (id + deleted_at filter)
  const assignmentExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedAssignment);
  const assignmentWhere2 = vi.fn().mockReturnValue({ executeTakeFirst: assignmentExecuteTakeFirst });
  const assignmentWhere1 = vi.fn().mockReturnValue({ where: assignmentWhere2 });
  const assignmentSelect = vi.fn().mockReturnValue({ where: assignmentWhere1 });

  // Insert
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(insertedRow);
  const insertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ returningAll: insertReturningAll });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "assignments") return { select: assignmentSelect };
    return { innerJoin: branchInnerJoin1 };
  });

  const db = { selectFrom, insertInto } as unknown as Kysely<Database>;
  return { db, insertValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("addBranchAssignment", () => {
  it("inserts a branch assignment and returns the created row", async () => {
    const { db, insertValues } = buildDbMock();

    const result = await addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: BRANCH_ID,
        assignment_id: ASSIGNMENT_ID,
        highlight: false,
      })
    );
    expect(result.id).toBe(BA_ID);
    expect(result.branchId).toBe(BRANCH_ID);
    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
  });

  it("respects provided highlight and sortOrder values", async () => {
    const { db, insertValues } = buildDbMock({
      insertedRow: { ...INSERTED_ROW, highlight: true, sort_order: 5 },
    });

    await addBranchAssignment(db, MOCK_ADMIN, { ...VALID_INPUT, highlight: true, sortOrder: 5 });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ highlight: true, sort_order: 5 })
    );
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock({ assignmentRow: null });

    await expect(
      addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws FORBIDDEN when assignment belongs to a different employee", async () => {
    const { db } = buildDbMock({ assignmentRow: { employee_id: EMPLOYEE_ID_2 } });

    await expect(
      addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can add to their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      addBranchAssignment(db, MOCK_CONSULTANT, VALID_INPUT)
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      addBranchAssignment(db, MOCK_CONSULTANT_2, VALID_INPUT)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createAddBranchAssignmentHandler", () => {
  it("calls addBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createAddBranchAssignmentHandler(db);

    const result = await call(
      handler,
      VALID_INPUT,
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(BA_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createAddBranchAssignmentHandler(db);

    await expect(
      call(handler, VALID_INPUT, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
