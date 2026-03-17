import { describe, it, expect, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { resolveEmployeeId } from "./resolve-employee-id.js";
import { MOCK_ADMIN, MOCK_CONSULTANT } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Unit tests for resolveEmployeeId helper.
//
// resolveEmployeeId determines the employee ID constraint based on the
// authenticated user's role:
//   - admin     → null  (no ownership restriction)
//   - consultant → employee.id if found by email, throws FORBIDDEN otherwise
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440010";

function buildSelectMock(row: unknown) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const where = vi.fn().mockReturnValue({ executeTakeFirst });
  const select = vi.fn().mockReturnValue({ where });
  const selectFrom = vi.fn().mockReturnValue({ select });
  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db, selectFrom, select, where, executeTakeFirst };
}

describe("resolveEmployeeId", () => {
  it("returns null for an admin user without querying the database", async () => {
    const { db, selectFrom } = buildSelectMock(undefined);

    const result = await resolveEmployeeId(db, MOCK_ADMIN);

    expect(result).toBeNull();
    expect(selectFrom).not.toHaveBeenCalled();
  });

  it("returns the employee id for a consultant whose email matches an employee record", async () => {
    const { db } = buildSelectMock({ id: EMPLOYEE_ID });

    const result = await resolveEmployeeId(db, MOCK_CONSULTANT);

    expect(result).toBe(EMPLOYEE_ID);
  });

  it("returns null for a consultant with no matching employee record", async () => {
    const { db } = buildSelectMock(undefined);
    const user = { ...MOCK_CONSULTANT, email: "unknown@example.com" };

    const result = await resolveEmployeeId(db, user);
    expect(result).toBeNull();
  });

  it("queries employees by the consultant's email", async () => {
    const { db, where } = buildSelectMock({ id: EMPLOYEE_ID });

    await resolveEmployeeId(db, MOCK_CONSULTANT);

    expect(where).toHaveBeenCalledWith("email", "=", MOCK_CONSULTANT.email);
  });
});
