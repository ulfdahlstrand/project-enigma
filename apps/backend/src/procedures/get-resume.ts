import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { getResumeOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// getResume — query logic
// ---------------------------------------------------------------------------

type GetResumeOutput = z.infer<typeof getResumeOutputSchema>;

/**
 * Fetches a single resume with its skills by ID.
 *
 * Access rules:
 *   - Admins can fetch any resume.
 *   - Consultants can only fetch resumes belonging to their employee record;
 *     throws FORBIDDEN if the resume belongs to a different employee.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the resume to retrieve.
 * @throws ORPCError("NOT_FOUND")  if the resume does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to access another's resume.
 */
export async function getResume(
  db: Kysely<Database>,
  user: AuthUser,
  id: string
): Promise<GetResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resumeRow = await db
    .selectFrom("resumes")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (resumeRow === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && resumeRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const skillRows = await db
    .selectFrom("resume_skills")
    .selectAll()
    .where("cv_id", "=", id)
    .orderBy("sort_order", "asc")
    .execute();

  return {
    id: resumeRow.id,
    employeeId: resumeRow.employee_id,
    title: resumeRow.title,
    summary: resumeRow.summary,
    language: resumeRow.language,
    isMain: resumeRow.is_main,
    createdAt: resumeRow.created_at,
    updatedAt: resumeRow.updated_at,
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

export const getResumeHandler = implement(contract.getResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getResume(getDb(), user, input.id);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `getResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createGetResumeHandler(db: Kysely<Database>) {
  return implement(contract.getResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResume(db, user, input.id);
    }
  );
}
