import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { deleteEmployee } from "./delete.js";

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440099";

function buildDeleteMock(deletedRow: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(deletedRow);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const where = vi.fn().mockReturnValue({ returning });
  const deleteFrom = vi.fn().mockReturnValue({ where });
  const db = { deleteFrom } as unknown as Kysely<Database>;
  return { db, deleteFrom };
}

describe("deleteEmployee", () => {
  it("returns { deleted: true } when the employee exists", async () => {
    const { db, deleteFrom } = buildDeleteMock({ id: EMPLOYEE_ID });

    const result = await deleteEmployee(db, EMPLOYEE_ID);

    expect(result).toEqual({ deleted: true });
    expect(deleteFrom).toHaveBeenCalledWith("employees");
  });

  it("throws NOT_FOUND when the employee does not exist", async () => {
    const { db } = buildDeleteMock(undefined);

    await expect(deleteEmployee(db, EMPLOYEE_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });
});
