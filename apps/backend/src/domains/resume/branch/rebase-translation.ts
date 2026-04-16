import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readTreeContent } from "../lib/read-tree-content.js";
import { buildCommitTree } from "../lib/build-commit-tree.js";
import type {
  rebaseTranslationOntoSourceInputSchema,
  rebaseTranslationOntoSourceOutputSchema,
} from "@cv-tool/contracts";

type RebaseTranslationOntoSourceInput = z.infer<typeof rebaseTranslationOntoSourceInputSchema>;
type RebaseTranslationOntoSourceOutput = z.infer<typeof rebaseTranslationOntoSourceOutputSchema>;

// ---------------------------------------------------------------------------
// rebaseTranslationOntoSource — core logic
// ---------------------------------------------------------------------------

/**
 * "Ful rebase" for translation branches — the counterpart to mergeRevision
 * for the translation type.
 *
 * Takes the source variant's current HEAD content, creates a new commit on
 * the translation branch with that content, and advances source_commit_id so
 * the branch is no longer stale. The translator then re-translates changed
 * sections from the newly imported source content.
 *
 * This is intentionally destructive: the translation's previous HEAD content
 * is replaced with untranslated source content. Use when the source has
 * changed enough that a fresh translation is preferable to manual diffing.
 *
 * Access rules:
 *   - Admins can rebase any translation branch.
 *   - Consultants can only rebase branches on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { branchId }
 * @throws ORPCError("NOT_FOUND")   if the branch does not exist.
 * @throws ORPCError("BAD_REQUEST") if branch is not a translation, or
 *                                   source has no HEAD commit.
 * @throws ORPCError("FORBIDDEN")   if a consultant does not own the resume.
 */
export async function rebaseTranslationOntoSource(
  db: Kysely<Database>,
  user: AuthUser,
  input: RebaseTranslationOntoSourceInput,
): Promise<RebaseTranslationOntoSourceOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const translation = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .leftJoin("resume_branches as source_rb", "source_rb.id", "rb.source_branch_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.name",
      "rb.language",
      "rb.is_main",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "rb.branch_type",
      "rb.source_branch_id",
      "rb.source_commit_id",
      "rb.created_by",
      "rb.created_at",
      "rb.is_archived",
      "r.employee_id",
      "source_rb.head_commit_id as source_head_commit_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (translation === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && translation.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (translation.branch_type !== "translation") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only translation branches can be rebased onto their source",
    });
  }

  if (translation.source_head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Source variant has no commits — cannot rebase",
    });
  }

  // Fetch the source HEAD commit's tree so we can copy its content.
  const sourceCommitRow = await db
    .selectFrom("resume_commits")
    .select(["tree_id"])
    .where("id", "=", translation.source_head_commit_id)
    .executeTakeFirst();

  if (sourceCommitRow === undefined || !sourceCommitRow.tree_id) {
    throw new ORPCError("BAD_REQUEST", { message: "Source HEAD commit has no content tree" });
  }

  const sourceContent = await readTreeContent(db, sourceCommitRow.tree_id);

  const updatedBranch = await db.transaction().execute(async (trx) => {
    const treeId = await buildCommitTree(
      trx,
      translation.resume_id,
      translation.employee_id,
      sourceContent,
      sourceCommitRow.tree_id,
    );

    const newCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: translation.resume_id,
        tree_id: treeId,
        title: "Rebase translation onto source",
        description:
          "Replaced translation content with the latest source version. Re-translate the changed sections.",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (translation.head_commit_id !== null) {
      await trx
        .insertInto("resume_commit_parents")
        .values({
          commit_id: newCommit.id,
          parent_commit_id: translation.head_commit_id,
          parent_order: 0,
        })
        .execute();
    }

    const updated = await trx
      .updateTable("resume_branches")
      .set({
        head_commit_id: newCommit.id,
        source_commit_id: translation.source_head_commit_id!,
      })
      .where("id", "=", input.branchId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });

  return {
    id: updatedBranch.id,
    resumeId: updatedBranch.resume_id,
    name: updatedBranch.name,
    language: updatedBranch.language,
    isMain: updatedBranch.is_main,
    headCommitId: updatedBranch.head_commit_id,
    forkedFromCommitId: updatedBranch.forked_from_commit_id,
    createdBy: updatedBranch.created_by,
    createdAt: updatedBranch.created_at,
    branchType: updatedBranch.branch_type,
    sourceBranchId: updatedBranch.source_branch_id,
    sourceCommitId: updatedBranch.source_commit_id,
    // After rebase source_commit_id == source HEAD → no longer stale
    isStale: false,
    isArchived: updatedBranch.is_archived,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const rebaseTranslationOntoSourceHandler = implement(
  contract.rebaseTranslationOntoSource,
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return rebaseTranslationOntoSource(getDb(), user, input);
});

export function createRebaseTranslationOntoSourceHandler(db: Kysely<Database>) {
  return implement(contract.rebaseTranslationOntoSource).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return rebaseTranslationOntoSource(db, user, input);
    },
  );
}
