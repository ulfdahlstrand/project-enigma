import { implement } from "@orpc/server";
import { contract, listEmployeesOutputSchema } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

// ---------------------------------------------------------------------------
// listEmployees — query logic
//
// The query logic is extracted into a plain async function so it can be unit
// tested with a mock Kysely instance without relying on oRPC internals.
// The oRPC handler below delegates to this function, passing the production
// database singleton by default.
// ---------------------------------------------------------------------------

type ListEmployeesOutput = z.infer<typeof listEmployeesOutputSchema>;

/**
 * Queries all rows from the `employees` table and validates them against the
 * shared contract output schema.
 *
 * @param db - Kysely instance (real or mock). Defaults to the production singleton.
 */
export async function fetchEmployees(
  db: Kysely<Database> = getDb()
): Promise<ListEmployeesOutput> {
  const rows = await db.selectFrom("employees").selectAll().execute();
  return listEmployeesOutputSchema.parse(rows);
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
//
// Wraps `fetchEmployees` as an oRPC procedure that matches the contract
// defined in @cv-tool/contracts. The output schema declared in the contract
// means oRPC also validates the output at the transport layer.
// ---------------------------------------------------------------------------

export const listEmployeesHandler = implement(contract.listEmployees).handler(
  async ({ context }) => {
    requireAuth(context as AuthContext);
    return fetchEmployees();
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `listEmployees` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createListEmployeesHandler(db: Kysely<Database>) {
  return implement(contract.listEmployees).handler(async ({ context }) => {
    requireAuth(context as AuthContext);
    return fetchEmployees(db);
  });
}
