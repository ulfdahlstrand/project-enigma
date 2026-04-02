import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { deleteResumeBranch, createDeleteResumeBranchHandler } from "./delete.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";

const BRANCH_ROW = { id: BRANCH_ID, is_main: false, employee_id: EMPLOYEE_ID_1 };

function buildDbMock(opts: {
  row?: unknown;
  employeeId?: string | null;
} = {}) {
  const { row = BRANCH_ROW, employeeId = null } = opts;

  const resolvedRow = row === null ? undefined : row;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedRow);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  const deleteExecute = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockReturnValue({ execute: deleteExecute });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: branchInnerJoin };
  });

  const db = { selectFrom, deleteFrom } as unknown as Kysely<Database>;
  return { db, deleteWhere };
}

describe("deleteResumeBranch", () => {
  it("deletes a non-main branch", async () => {
    const { db, deleteWhere } = buildDbMock();

    const result = await deleteResumeBranch(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(deleteWhere).toHaveBeenCalledWith("id", "=", BRANCH_ID);
    expect(result).toEqual({ deleted: true });
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ row: null });

    await expect(
      deleteResumeBranch(db, MOCK_ADMIN, { branchId: BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws BAD_REQUEST when deleting main branch", async () => {
    const { db } = buildDbMock({ row: { ...BRANCH_ROW, is_main: true } });

    await expect(
      deleteResumeBranch(db, MOCK_ADMIN, { branchId: BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST",
    );
  });

  it("consultant can delete own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      deleteResumeBranch(db, MOCK_CONSULTANT, { branchId: BRANCH_ID }),
    ).resolves.toEqual({ deleted: true });
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      deleteResumeBranch(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createDeleteResumeBranchHandler", () => {
  it("calls deleteResumeBranch with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createDeleteResumeBranchHandler(db);

    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createDeleteResumeBranchHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
