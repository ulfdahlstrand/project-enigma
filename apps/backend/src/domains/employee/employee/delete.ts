import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

export async function deleteEmployee(
  db: Kysely<Database>,
  id: string,
): Promise<{ deleted: true }> {
  const deleted = await db
    .deleteFrom("employees")
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();

  if (deleted === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return { deleted: true };
}

export const deleteEmployeeHandler = implement(contract.deleteEmployee).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return deleteEmployee(getDb(), input.id);
  },
);
