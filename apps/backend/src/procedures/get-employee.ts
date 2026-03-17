import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";

// ---------------------------------------------------------------------------
// getEmployee — query logic
//
// The query logic is extracted into a plain async function so it can be unit
// tested with a mock Kysely instance without relying on oRPC internals.
// ---------------------------------------------------------------------------

/**
 * Fetches a single employee by ID.
 * Throws ORPCError({ code: 'NOT_FOUND' }) if no row is found.
 *
 * @param db - Kysely instance (real or mock). Defaults to the production singleton.
 * @param id - UUID of the employee to retrieve.
 */
export async function getEmployee(
  db: Kysely<Database>,
  id: string
): Promise<{
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const row = await db
    .selectFrom("employees")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const getEmployeeHandler = implement(contract.getEmployee).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return getEmployee(getDb(), input.id);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used to inject a custom Kysely instance (e.g. in tests)
// ---------------------------------------------------------------------------

/**
 * Creates a `getEmployee` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createGetEmployeeHandler(db: Kysely<Database>) {
  return implement(contract.getEmployee).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return getEmployee(db, input.id);
  });
}
