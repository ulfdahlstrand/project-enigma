import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AppContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { getCVOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// getCV — query logic
// ---------------------------------------------------------------------------

type GetCVOutput = z.infer<typeof getCVOutputSchema>;

/**
 * Fetches a single CV with its skills by ID.
 *
 * Access rules:
 *   - Admins can fetch any CV.
 *   - Consultants can only fetch CVs belonging to their employee record;
 *     throws FORBIDDEN if the CV belongs to a different employee.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the CV to retrieve.
 * @throws ORPCError("NOT_FOUND")  if the CV does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to access another's CV.
 */
export async function getCV(
  db: Kysely<Database>,
  user: AuthUser,
  id: string
): Promise<GetCVOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const cvRow = await db
    .selectFrom("cvs")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (cvRow === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && cvRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const skillRows = await db
    .selectFrom("cv_skills")
    .selectAll()
    .where("cv_id", "=", id)
    .orderBy("sort_order", "asc")
    .execute();

  return {
    id: cvRow.id,
    employeeId: cvRow.employee_id,
    title: cvRow.title,
    summary: cvRow.summary,
    language: cvRow.language,
    isMain: cvRow.is_main,
    createdAt: cvRow.created_at,
    updatedAt: cvRow.updated_at,
    skills: skillRows.map((s) => ({
      id: s.id,
      cvId: s.cv_id,
      name: s.name,
      level: s.level,
      category: s.category,
      sortOrder: s.sort_order,
    })),
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const getCVHandler = implement(contract.getCV).handler(
  async ({ input, context }: { input: { id: string }; context: AppContext }) => {
    const user = requireAuth(context);
    return getCV(getDb(), user, input.id);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `getCV` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createGetCVHandler(db: Kysely<Database>) {
  return implement(contract.getCV).handler(
    async ({ input, context }: { input: { id: string }; context: AppContext }) => {
      const user = requireAuth(context);
      return getCV(db, user, input.id);
    }
  );
}
