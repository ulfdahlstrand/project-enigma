import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AppContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { createCVInputSchema, createCVOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// createCV — query logic
// ---------------------------------------------------------------------------

type CreateCVInput = z.infer<typeof createCVInputSchema>;
type CreateCVOutput = z.infer<typeof createCVOutputSchema>;

/**
 * Inserts a new CV record and returns the created CV with an empty skills array.
 *
 * Access rules:
 *   - Admins can create CVs for any employee.
 *   - Consultants can only create CVs for their own employee record;
 *     throws FORBIDDEN if the input employeeId does not match their own.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - CV creation parameters.
 * @throws ORPCError("FORBIDDEN") if a consultant tries to create a CV for another employee.
 */
export async function createCV(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateCVInput
): Promise<CreateCVOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Consultants may only create CVs for their own employee record
  if (ownerEmployeeId !== null && input.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const row = await db
    .insertInto("cvs")
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

export const createCVHandler = implement(contract.createCV).handler(
  async ({ input, context }: { input: CreateCVInput; context: AppContext }) => {
    const user = requireAuth(context);
    return createCV(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `createCV` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createCreateCVHandler(db: Kysely<Database>) {
  return implement(contract.createCV).handler(
    async ({ input, context }: { input: CreateCVInput; context: AppContext }) => {
      const user = requireAuth(context);
      return createCV(db, user, input);
    }
  );
}
