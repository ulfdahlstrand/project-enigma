import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { updateResumeInputSchema, updateResumeOutputSchema } from "@cv-tool/contracts";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";

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
  let mainBranchId: string | null = null;
  if (ownerEmployeeId !== null) {
    const existing = await db
      .selectFrom("resumes as r")
      .leftJoin("resume_branches as rb", (join) =>
        join.onRef("rb.resume_id", "=", "r.id").on("rb.is_main", "=", true)
      )
      .select(["r.employee_id", "rb.id as branch_id"])
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (existing === undefined) {
      throw new ORPCError("NOT_FOUND");
    }
    if (existing.employee_id !== ownerEmployeeId) {
      throw new ORPCError("FORBIDDEN");
    }
    mainBranchId = existing.branch_id ?? null;
  } else {
    const existing = await db
      .selectFrom("resume_branches")
      .select("id")
      .where("resume_id", "=", input.id)
      .where("is_main", "=", true)
      .executeTakeFirst();
    mainBranchId = existing?.id ?? null;
  }

  const set: {
    title?: string;
    language?: string;
    is_main?: boolean;
  } = {};

  if (input.title !== undefined) set.title = input.title;
  if (input.language !== undefined) set.language = input.language;
  if (input.isMain !== undefined) set.is_main = input.isMain;

  const { updatedResume, branchContent } = await db.transaction().execute(async (trx) => {
    const updatedResume = await trx
      .updateTable("resumes")
      .set(set)
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirst();

    if (updatedResume === undefined) {
      throw new ORPCError("NOT_FOUND");
    }

    const nextBranchContent = mainBranchId !== null
      ? await upsertBranchContentFromLive(trx, {
        resumeId: input.id,
        branchId: mainBranchId,
        userId: user.id,
        ...(input.consultantTitle !== undefined ? { consultantTitle: input.consultantTitle } : {}),
        ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.highlightedItems !== undefined ? { highlightedItems: input.highlightedItems.map((s) => s.trim()).filter(Boolean) } : {}),
      })
      : null;

    return { updatedResume, branchContent: nextBranchContent };
  });

  if (updatedResume === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  return {
    id: updatedResume.id,
    employeeId: updatedResume.employee_id,
    title: updatedResume.title,
    consultantTitle: branchContent?.consultantTitle ?? null,
    presentation: branchContent?.presentation ?? [],
    summary: branchContent?.summary ?? null,
    highlightedItems: branchContent?.highlightedItems ?? [],
    language: updatedResume.language,
    isMain: updatedResume.is_main,
    createdAt: updatedResume.created_at,
    updatedAt: updatedResume.updated_at,
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
