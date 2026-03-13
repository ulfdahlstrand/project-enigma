import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";

// ---------------------------------------------------------------------------
// createEmployee — query logic
// ---------------------------------------------------------------------------

/**
 * Inserts a new employee record and returns the created row.
 *
 * @param db   - Kysely instance (real or mock). Defaults to the production singleton.
 * @param name  - The employee's full name.
 * @param email - The employee's email address.
 */
export async function createEmployee(
  db: Kysely<Database>,
  name: string,
  email: string
): Promise<{
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const row = await db
    .insertInto("employees")
    .values({ name, email })
    .returningAll()
    .executeTakeFirstOrThrow();

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

export const createEmployeeHandler = implement(contract.createEmployee).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createEmployee(getDb(), input.name, input.email);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used to inject a custom Kysely instance (e.g. in tests)
// ---------------------------------------------------------------------------

/**
 * Creates a `createEmployee` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createCreateEmployeeHandler(db: Kysely<Database>) {
  return implement(contract.createEmployee).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createEmployee(db, input.name, input.email);
  });
}
