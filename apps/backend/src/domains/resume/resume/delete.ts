import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";

// ---------------------------------------------------------------------------
// deleteResume — query logic
// ---------------------------------------------------------------------------

/**
 * Deletes a resume by ID.
 *
 * Access rules:
 *   - Admins can delete any resume.
 *   - Consultants can only delete resumes belonging to their own employee record.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the resume to delete.
 * @returns { deleted: true }
 * @throws ORPCError("NOT_FOUND")  if no resume matches the given id.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to delete another's resume.
 */
export async function deleteResume(
  db: Kysely<Database>,
  user: AuthUser,
  id: string
): Promise<{ deleted: true }> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Ownership check for consultants: verify the resume's employee_id
  if (ownerEmployeeId !== null) {
    const existing = await db
      .selectFrom("resumes")
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
    .deleteFrom("resumes")
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

export const deleteResumeHandler = implement(contract.deleteResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return deleteResume(getDb(), user, input.id);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `deleteResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createDeleteResumeHandler(db: Kysely<Database>) {
  return implement(contract.deleteResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return deleteResume(db, user, input.id);
    }
  );
}
