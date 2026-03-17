import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";

// ---------------------------------------------------------------------------
// updateEmployee — query logic
// ---------------------------------------------------------------------------

/**
 * Updates an existing employee's name and/or email, returning the updated row.
 * Throws ORPCError({ code: 'NOT_FOUND' }) if no row is found.
 *
 * @param db      - Kysely instance (real or mock).
 * @param id      - UUID of the employee to update.
 * @param updates - Object with optional `name` and/or `email` fields to update.
 */
export async function updateEmployee(
  db: Kysely<Database>,
  id: string,
  updates: { name?: string; email?: string; title?: string | null; presentation?: string[] }
): Promise<{
  id: string;
  name: string;
  email: string;
  title: string | null;
  presentation: string[];
  createdAt: Date;
  updatedAt: Date;
}> {
  const set: { name?: string; email?: string; title?: string | null; presentation?: string[] } = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.email !== undefined) set.email = updates.email;
  if (updates.title !== undefined) set.title = updates.title;
  if (updates.presentation !== undefined) set.presentation = updates.presentation;

  const row = await db
    .updateTable("employees")
    .set(set)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    presentation: row.presentation ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const updateEmployeeHandler = implement(contract.updateEmployee).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateEmployee(getDb(), input.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.presentation !== undefined && { presentation: input.presentation }),
    });
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used to inject a custom Kysely instance (e.g. in tests)
// ---------------------------------------------------------------------------

/**
 * Creates an `updateEmployee` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createUpdateEmployeeHandler(db: Kysely<Database>) {
  return implement(contract.updateEmployee).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateEmployee(db, input.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.presentation !== undefined && { presentation: input.presentation }),
    });
  });
}
