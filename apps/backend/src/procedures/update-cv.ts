import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AppContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { updateCVInputSchema, updateCVOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// updateCV — query logic
// ---------------------------------------------------------------------------

type UpdateCVInput = z.infer<typeof updateCVInputSchema>;
type UpdateCVOutput = z.infer<typeof updateCVOutputSchema>;

/**
 * Updates an existing CV's fields and returns the updated row.
 *
 * Access rules:
 *   - Admins can update any CV.
 *   - Consultants can only update CVs belonging to their own employee record.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Update parameters (id + fields to update).
 * @throws ORPCError("NOT_FOUND")  if no CV matches the given id.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to update another's CV.
 */
export async function updateCV(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateCVInput
): Promise<UpdateCVOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Ownership check for consultants: fetch the CV's employee_id first
  if (ownerEmployeeId !== null) {
    const existing = await db
      .selectFrom("cvs")
      .select("employee_id")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (existing === undefined) {
      throw new ORPCError("NOT_FOUND");
    }
    if (existing.employee_id !== ownerEmployeeId) {
      throw new ORPCError("FORBIDDEN");
    }
  }

  const set: {
    title?: string;
    summary?: string | null;
    language?: string;
    is_main?: boolean;
  } = {};

  if (input.title !== undefined) set.title = input.title;
  if (input.summary !== undefined) set.summary = input.summary;
  if (input.language !== undefined) set.language = input.language;
  if (input.isMain !== undefined) set.is_main = input.isMain;

  const row = await db
    .updateTable("cvs")
    .set(set)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirst();

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    summary: row.summary,
    language: row.language,
    isMain: row.is_main,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const updateCVHandler = implement(contract.updateCV).handler(
  async ({ input, context }: { input: UpdateCVInput; context: AppContext }) => {
    const user = requireAuth(context);
    return updateCV(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates an `updateCV` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createUpdateCVHandler(db: Kysely<Database>) {
  return implement(contract.updateCV).handler(
    async ({ input, context }: { input: UpdateCVInput; context: AppContext }) => {
      const user = requireAuth(context);
      return updateCV(db, user, input);
    }
  );
}
