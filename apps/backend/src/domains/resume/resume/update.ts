import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import { sql } from "kysely";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { updateResumeInputSchema, updateResumeOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// updateResume — query logic
// ---------------------------------------------------------------------------

type UpdateResumeInput = z.infer<typeof updateResumeInputSchema>;
type UpdateResumeOutput = z.infer<typeof updateResumeOutputSchema>;

/**
 * Updates an existing resume's fields and returns the updated row.
 *
 * Access rules:
 *   - Admins can update any resume.
 *   - Consultants can only update resumes belonging to their own employee record.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Update parameters (id + fields to update).
 * @throws ORPCError("NOT_FOUND")  if no resume matches the given id.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to update another's resume.
 */
export async function updateResume(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateResumeInput
): Promise<UpdateResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Ownership check for consultants: fetch the resume's employee_id first
  if (ownerEmployeeId !== null) {
    const existing = await db
      .selectFrom("resumes")
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
    consultant_title?: string | null;
    presentation?: string[];
    summary?: string | null;
    language?: string;
    is_main?: boolean;
  } = {};

  if (input.title !== undefined) set.title = input.title;
  if (input.consultantTitle !== undefined) set.consultant_title = input.consultantTitle;
  if (input.presentation !== undefined) {
    set.presentation = sql`${JSON.stringify(input.presentation)}::jsonb` as unknown as string[];
  }
  if (input.summary !== undefined) set.summary = input.summary;
  if (input.language !== undefined) set.language = input.language;
  if (input.isMain !== undefined) set.is_main = input.isMain;

  const row = await db.transaction().execute(async (trx) => {
    const updatedResume = await trx
      .updateTable("resumes")
      .set(set)
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirst();

    if (updatedResume === undefined) {
      throw new ORPCError("NOT_FOUND");
    }

    if (input.highlightedItems !== undefined) {
      await trx
        .deleteFrom("resume_highlighted_items")
        .where("resume_id", "=", input.id)
        .execute();

      const nextHighlightedItems = input.highlightedItems
        .map((item) => item.trim())
        .filter(Boolean);

      if (nextHighlightedItems.length > 0) {
        await trx
          .insertInto("resume_highlighted_items")
          .values(
            nextHighlightedItems.map((text, index) => ({
              resume_id: input.id,
              text,
              sort_order: index,
            })),
          )
          .execute();
      }
    }

    return updatedResume;
  });

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  const highlightedItemRows = await db
    .selectFrom("resume_highlighted_items")
    .select(["text"])
    .where("resume_id", "=", input.id)
    .orderBy("sort_order", "asc")
    .execute();

  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    consultantTitle: row.consultant_title,
    presentation: row.presentation ?? [],
    summary: row.summary,
    highlightedItems: highlightedItemRows.map((item) => item.text),
    language: row.language,
    isMain: row.is_main,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const updateResumeHandler = implement(contract.updateResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateResume(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates an `updateResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createUpdateResumeHandler(db: Kysely<Database>) {
  return implement(contract.updateResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return updateResume(db, user, input);
    }
  );
}
