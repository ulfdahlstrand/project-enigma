import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { listResumesInputSchema, listResumesOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// listResumes — query logic
//
// The query logic is extracted into a plain async function so it can be unit
// tested with a mock Kysely instance without relying on oRPC internals.
// ---------------------------------------------------------------------------

type ListResumesInput = z.infer<typeof listResumesInputSchema>;
type ListResumesOutput = z.infer<typeof listResumesOutputSchema>;

/**
 * Queries resumes from the database with optional filters.
 *
 * Access rules:
 *   - Admins can see all resumes and may optionally filter by employeeId or language.
 *   - Consultants only see resumes belonging to their own employee record;
 *     any employeeId filter in the input is ignored for ownership purposes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Optional filter parameters (employeeId, language).
 */
export async function listResumes(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListResumesInput
): Promise<ListResumesOutput> {
  // Determine ownership constraint
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  let query = db.selectFrom("resumes").selectAll();

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

export const listResumesHandler = implement(contract.listResumes).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listResumes(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `listResumes` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createListResumesHandler(db: Kysely<Database>) {
  return implement(contract.listResumes).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listResumes(db, user, input);
    }
  );
}
