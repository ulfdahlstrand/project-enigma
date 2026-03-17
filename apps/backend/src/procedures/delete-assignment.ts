import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";

export async function deleteAssignment(db: Kysely<Database>, id: string) {
  const row = await db
    .deleteFrom("assignments")
    .where("id", "=", id)
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
