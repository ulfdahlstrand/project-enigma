import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";

function rowToEducation(row: {
  id: string;
  employee_id: string;
  type: string;
  value: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type as "degree" | "certification" | "language",
    value: row.value,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { rowToEducation };

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

export function createListEducationHandler(db: Kysely<Database>) {
  return implement(contract.listEducation).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return listEducation(db, input.employeeId);
  });
}
