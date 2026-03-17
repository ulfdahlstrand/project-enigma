import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AppContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { listCVsInputSchema, listCVsOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// listCVs — query logic
//
// The query logic is extracted into a plain async function so it can be unit
// tested with a mock Kysely instance without relying on oRPC internals.
// ---------------------------------------------------------------------------

type ListCVsInput = z.infer<typeof listCVsInputSchema>;
type ListCVsOutput = z.infer<typeof listCVsOutputSchema>;

/**
 * Queries CVs from the database with optional filters.
 *
 * Access rules:
 *   - Admins can see all CVs and may optionally filter by employeeId or language.
 *   - Consultants only see CVs belonging to their own employee record;
 *     any employeeId filter in the input is ignored for ownership purposes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Optional filter parameters (employeeId, language).
 */
export async function listCVs(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListCVsInput
): Promise<ListCVsOutput> {
  // Determine ownership constraint
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  let query = db.selectFrom("cvs").selectAll();

  if (ownerEmployeeId !== null) {
    // Consultant: scope to their own employee, but still allow language filter
    query = query.where("employee_id", "=", ownerEmployeeId);
    if (input.language !== undefined) {
      query = query.where("language", "=", input.language);
    }
  } else {
    // Admin: apply optional filters from input
    if (input.employeeId !== undefined) {
      query = query.where("employee_id", "=", input.employeeId);
    }
    if (input.language !== undefined) {
      query = query.where("language", "=", input.language);
    }
  }

  const rows = await query.execute();

  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    summary: row.summary,
    language: row.language,
    isMain: row.is_main,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const listCVsHandler = implement(contract.listCVs).handler(
  async ({ input, context }: { input: ListCVsInput; context: AppContext }) => {
    const user = requireAuth(context);
    return listCVs(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `listCVs` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createListCVsHandler(db: Kysely<Database>) {
  return implement(contract.listCVs).handler(
    async ({ input, context }: { input: ListCVsInput; context: AppContext }) => {
      const user = requireAuth(context);
      return listCVs(db, user, input);
    }
  );
}
