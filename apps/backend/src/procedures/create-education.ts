import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";
import { rowToEducation } from "./list-education.js";
import type { createEducationInputSchema } from "@cv-tool/contracts";

type CreateEducationInput = z.infer<typeof createEducationInputSchema>;

export async function createEducation(db: Kysely<Database>, input: CreateEducationInput) {
  const row = await db
    .insertInto("education")
    .values({
      employee_id: input.employeeId,
      type: input.type,
      value: input.value,
      sort_order: input.sortOrder ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToEducation(row);
}

export const createEducationHandler = implement(contract.createEducation).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createEducation(getDb(), input);
  }
);

export function createCreateEducationHandler(db: Kysely<Database>) {
  return implement(contract.createEducation).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createEducation(db, input);
  });
}
