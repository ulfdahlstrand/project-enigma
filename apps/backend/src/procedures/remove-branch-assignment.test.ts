import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { removeBranchAssignment, createRemoveBranchAssignmentHandler } from "./remove-branch-assignment.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BA_ID = "550e8400-e29b-41d4-a716-446655440061";

const ROW = { id: BA_ID, employee_id: EMPLOYEE_ID_1 };

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  row?: unknown;
  employeeId?: string | null;
} = {}) {
  const { row = ROW, employeeId = null } = opts;

  const resolvedRow = row === null ? undefined : row;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // ba + branch + resume join
  const rowExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedRow);
  const rowWhere = vi.fn().mockReturnValue({ executeTakeFirst: rowExecuteTakeFirst });
  const rowSelect = vi.fn().mockReturnValue({ where: rowWhere });
  const rowInnerJoin2 = vi.fn().mockReturnValue({ select: rowSelect });
  const rowInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: rowInnerJoin2 });

  // Delete
  const deleteExecute = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockReturnValue({ execute: deleteExecute });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: rowInnerJoin1 };
  });

  const db = { selectFrom, deleteFrom } as unknown as Kysely<Database>;
  return { db, deleteWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("removeBranchAssignment", () => {
  it("deletes the branch assignment and returns deleted: true", async () => {
    const { db, deleteWhere } = buildDbMock();

    const result = await removeBranchAssignment(db, MOCK_ADMIN, { id: BA_ID });

    expect(deleteWhere).toHaveBeenCalledWith("id", "=", BA_ID);
    expect(result).toEqual({ deleted: true });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock({ row: null });

    await expect(
      removeBranchAssignment(db, MOCK_ADMIN, { id: BA_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can remove from their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      removeBranchAssignment(db, MOCK_CONSULTANT, { id: BA_ID })
    ).resolves.toEqual({ deleted: true });
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      removeBranchAssignment(db, MOCK_CONSULTANT_2, { id: BA_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createRemoveBranchAssignmentHandler", () => {
  it("calls removeBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createRemoveBranchAssignmentHandler(db);

    const result = await call(handler, { id: BA_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createRemoveBranchAssignmentHandler(db);

    await expect(
      call(handler, { id: BA_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
