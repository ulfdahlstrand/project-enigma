import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { rowToEducation } from "../lib/row-to-education.js";
import type { updateEducationInputSchema } from "@cv-tool/contracts";

type UpdateEducationInput = z.infer<typeof updateEducationInputSchema>;

export async function updateEducation(db: Kysely<Database>, input: UpdateEducationInput) {
  const patch: {
    type?: UpdateEducationInput["type"];
    value?: string;
    sort_order?: number;
  } = {};

  if (input.type !== undefined) patch.type = input.type;
  if (input.value !== undefined) patch.value = input.value;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const row = await db
    .updateTable("education")
    .set(patch)
    .where("id", "=", input.id)
    .where("employee_id", "=", input.employeeId)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Education entry not found" });
  }

  return rowToEducation(row);
}

export const updateEducationHandler = implement(contract.updateEducation).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateEducation(getDb(), input);
  }
);

