import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

import { rowToEducation } from "../lib/row-to-education.js";

export async function listEducation(db: Kysely<Database>, employeeId: string) {
  const rows = await db
    .selectFrom("education")
    .selectAll()
    .where("employee_id", "=", employeeId)
    .orderBy("type", "asc")
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();

  return rows.map(rowToEducation);
}

export const listEducationHandler = implement(contract.listEducation).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return listEducation(getDb(), input.employeeId);
  }
);
