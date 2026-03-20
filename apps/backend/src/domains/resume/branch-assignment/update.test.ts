import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { updateBranchAssignment, createUpdateBranchAssignmentHandler } from "./update.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const BA_ID = "550e8400-e29b-41d4-a716-446655440061";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const EXISTING_ROW = {
  id: BA_ID,
  employee_id: EMPLOYEE_ID_1,
  assignment_employee_id: EMPLOYEE_ID_1,
};

const UPDATED_ROW = {
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
  highlight: true,
  sort_order: 3,
  created_at: new Date("2023-01-01"),
  updated_at: new Date("2023-01-01"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  existingRow?: unknown;
  updatedRow?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    existingRow = EXISTING_ROW,
    updatedRow = UPDATED_ROW,
    employeeId = null,
  } = opts;

  const resolvedRow = existingRow === null ? undefined : existingRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // ba + rb + r + a join (3 innerJoins), then two where calls (id + deleted_at filter)
  const rowExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedRow);
  const rowWhere2 = vi.fn().mockReturnValue({ executeTakeFirst: rowExecuteTakeFirst });
  const rowWhere1 = vi.fn().mockReturnValue({ where: rowWhere2 });
  const rowSelect = vi.fn().mockReturnValue({ where: rowWhere1 });
  const rowInnerJoin3 = vi.fn().mockReturnValue({ select: rowSelect });
  const rowInnerJoin2 = vi.fn().mockReturnValue({ innerJoin: rowInnerJoin3 });
  const rowInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: rowInnerJoin2 });

  // Update
  const updateExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(updatedRow);
  const updateReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: updateExecuteTakeFirstOrThrow });
  const updateWhere = vi.fn().mockReturnValue({ returningAll: updateReturningAll });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: rowInnerJoin1 };
  });

  const db = { selectFrom, updateTable } as unknown as Kysely<Database>;
  return { db, updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateBranchAssignment", () => {
  it("updates highlight and sortOrder, returns updated row", async () => {
    const { db, updateSet } = buildDbMock();

    const result = await updateBranchAssignment(db, MOCK_ADMIN, {
      id: BA_ID,
      highlight: true,
      sortOrder: 3,
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ highlight: true, sort_order: 3 })
    );
    expect(result).toMatchObject({
      id: BA_ID,
      assignmentId: ASSIGNMENT_ID,
      branchId: BRANCH_ID,
      highlight: true,
      sortOrder: 3,
    });
  });

  it("only includes provided fields in the update", async () => {
    const { db, updateSet } = buildDbMock();

    await updateBranchAssignment(db, MOCK_ADMIN, { id: BA_ID, highlight: false });

    const setArg = updateSet.mock.calls[0][0];
    expect(setArg).toHaveProperty("highlight", false);
    expect(setArg).not.toHaveProperty("sort_order");
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock({ existingRow: null });

    await expect(
      updateBranchAssignment(db, MOCK_ADMIN, { id: BA_ID, highlight: true })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can update their own branch assignment", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      updateBranchAssignment(db, MOCK_CONSULTANT, { id: BA_ID, highlight: true })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      updateBranchAssignment(db, MOCK_CONSULTANT_2, { id: BA_ID, highlight: true })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createUpdateBranchAssignmentHandler", () => {
  it("calls updateBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createUpdateBranchAssignmentHandler(db);

    const result = await call(
      handler,
      { id: BA_ID, highlight: true },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(BA_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createUpdateBranchAssignmentHandler(db);

    await expect(
      call(handler, { id: BA_ID, highlight: true }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
