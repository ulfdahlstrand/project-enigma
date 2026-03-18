import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { rowToAssignment } from "../lib/row-to-assignment.js";

export async function getAssignment(db: Kysely<Database>, id: string) {
  const row = await db
    .selectFrom("assignments")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
  }

  return rowToAssignment(row);
}

export const getAssignmentHandler = implement(contract.getAssignment).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return getAssignment(getDb(), input.id);
  }
);

export function createGetAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.getAssignment).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return getAssignment(db, input.id);
    }
  );
}
