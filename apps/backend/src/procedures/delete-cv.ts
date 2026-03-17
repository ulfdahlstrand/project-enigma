import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AppContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";

// ---------------------------------------------------------------------------
// deleteCV — query logic
// ---------------------------------------------------------------------------

/**
 * Deletes a CV by ID.
 *
 * Access rules:
 *   - Admins can delete any CV.
 *   - Consultants can only delete CVs belonging to their own employee record.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the CV to delete.
 * @returns { deleted: true }
 * @throws ORPCError("NOT_FOUND")  if no CV matches the given id.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to delete another's CV.
 */
export async function deleteCV(
  db: Kysely<Database>,
  user: AuthUser,
  id: string
): Promise<{ deleted: true }> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Ownership check for consultants: verify the CV's employee_id
  if (ownerEmployeeId !== null) {
    const existing = await db
      .selectFrom("cvs")
      .select("employee_id")
      .where("id", "=", id)
      .executeTakeFirst();

    if (existing === undefined) {
      throw new ORPCError("NOT_FOUND");
    }

    if (existing.employee_id !== ownerEmployeeId) {
      throw new ORPCError("FORBIDDEN");
    }
  }

  const deleted = await db
    .deleteFrom("cvs")
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();

  if (deleted === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const deleteCVHandler = implement(contract.deleteCV).handler(
  async ({ input, context }: { input: { id: string }; context: AppContext }) => {
    const user = requireAuth(context);
    return deleteCV(getDb(), user, input.id);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `deleteCV` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createDeleteCVHandler(db: Kysely<Database>) {
  return implement(contract.deleteCV).handler(
    async ({ input, context }: { input: { id: string }; context: AppContext }) => {
      const user = requireAuth(context);
      return deleteCV(db, user, input.id);
    }
  );
}
