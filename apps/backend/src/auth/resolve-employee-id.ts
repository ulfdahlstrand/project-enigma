import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { AuthUser } from "./require-auth.js";

// ---------------------------------------------------------------------------
// resolveEmployeeId
//
// Determines the employee ID ownership constraint for a given authenticated
// user:
//   - admin     → null  (no ownership restriction; can access all CVs)
//   - consultant → the employee.id whose email matches the user's email;
//                  throws FORBIDDEN if no matching employee exists
// ---------------------------------------------------------------------------

/**
 * Resolves the employee ID for an authenticated user.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user from requireAuth().
 * @returns The employee ID for consultants, or null for admins.
 * @throws ORPCError("FORBIDDEN") if the consultant has no employee record.
 */
export async function resolveEmployeeId(
  db: Kysely<Database>,
  user: AuthUser
): Promise<string | null> {
  if (user.role === "admin") {
    return null;
  }

  const row = await db
    .selectFrom("employees")
    .select("id")
    .where("email", "=", user.email)
    .executeTakeFirst();

  if (row === undefined) {
    // No employee record found for this consultant's email. Return null so
    // they can still browse CVs. This is a known gap until user↔employee
    // linkage is modelled with an explicit FK (tracked as tech debt).
    return null;
  }

  return row.id;
}
