import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

/**
 * Soft-deletes an assignment identity by setting deleted_at = NOW().
 *
 * This marks the assignment as deleted across ALL branches — the underlying
 * branch_assignments rows are retained (for audit / undo) but will be
 * filtered out of all read queries that check deleted_at IS NULL.
 *
 * Unlike removeBranchAssignment (which unlinks from a single branch),
 * deleteAssignment is a global operation that effectively removes the
 * assignment from every branch at once.
 *
 * @throws ORPCError("NOT_FOUND") if the assignment does not exist or is
 *         already soft-deleted.
 */
export async function deleteAssignment(db: Kysely<Database>, id: string) {
  const row = await db
    .updateTable("assignments")
    .set({ deleted_at: new Date() })
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
  }

  return { deleted: true as const };
}

export const deleteAssignmentHandler = implement(contract.deleteAssignment).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return deleteAssignment(getDb(), input.id);
  }
);

export function createDeleteAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.deleteAssignment).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return deleteAssignment(db, input.id);
    }
  );
}
