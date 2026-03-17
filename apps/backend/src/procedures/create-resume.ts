import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { createResumeInputSchema, createResumeOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// createResume — query logic
// ---------------------------------------------------------------------------

type CreateResumeInput = z.infer<typeof createResumeInputSchema>;
type CreateResumeOutput = z.infer<typeof createResumeOutputSchema>;

/**
 * Inserts a new resume record and returns the created resume with an empty skills array.
 *
 * Access rules:
 *   - Admins can create resumes for any employee.
 *   - Consultants can only create resumes for their own employee record;
 *     throws FORBIDDEN if the input employeeId does not match their own.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Resume creation parameters.
 * @throws ORPCError("FORBIDDEN") if a consultant tries to create a resume for another employee.
 */
export async function createResume(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateResumeInput
): Promise<CreateResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Consultants may only create resumes for their own employee record
  if (ownerEmployeeId !== null && input.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const row = await db
    .insertInto("resumes")
    .values({
      employee_id: input.employeeId,
      title: input.title,
      language: input.language ?? "en",
      summary: input.summary ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    consultantTitle: row.consultant_title,
    presentation: row.presentation ?? [],
    summary: row.summary,
    language: row.language,
    isMain: row.is_main,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    skills: [],
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const createResumeHandler = implement(contract.createResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createResume(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `createResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createCreateResumeHandler(db: Kysely<Database>) {
  return implement(contract.createResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createResume(db, user, input);
    }
  );
}
