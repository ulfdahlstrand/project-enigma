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
  rebaseRevisionOntoSourceInputSchema,
  rebaseRevisionOntoSourceOutputSchema,
} from "@cv-tool/contracts";

type RebaseRevisionOntoSourceInput = z.infer<typeof rebaseRevisionOntoSourceInputSchema>;
type RebaseRevisionOntoSourceOutput = z.infer<typeof rebaseRevisionOntoSourceOutputSchema>;

// ---------------------------------------------------------------------------
// rebaseRevisionOntoSource — core logic
// ---------------------------------------------------------------------------

/**
 * Unblocks a revision merge when the source variant has advanced past the
 * revision's fork point (which causes mergeRevisionIntoSource to throw CONFLICT).
 *
 * Strategy: create a new commit on the revision branch whose:
 *   - content  = the revision's current HEAD content (preserving the revision's changes)
 *   - parent   = the source variant's current HEAD (so the commit is logically on top
 *                of the source's latest state)
 *
 * After this operation:
 *   - revision.source_commit_id === source.head_commit_id
 *   - mergeRevisionIntoSource will succeed (fast-forward is unblocked)
 *
 * NOTE: this is "revision wins" semantics — the revision's content is kept
 * verbatim. If the source also changed the same sections, those source changes
 * are silently discarded. For MVP this is acceptable; a 3-way field-level merge
 * can be added later if needed.
 *
 * Access rules:
 *   - Admins can rebase any revision branch.
 *   - Consultants can only rebase branches on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { branchId }
 * @throws ORPCError("NOT_FOUND")   if the branch does not exist.
 * @throws ORPCError("BAD_REQUEST") if branch is not a revision, has no HEAD
 *                                   commit, source has no HEAD commit, or the
 *                                   source is not ahead of the fork point.
 * @throws ORPCError("FORBIDDEN")   if a consultant does not own the resume.
 */
export async function rebaseRevisionOntoSource(
  db: Kysely<Database>,
  user: AuthUser,
  input: RebaseRevisionOntoSourceInput,
): Promise<RebaseRevisionOntoSourceOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const revision = await db
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

  if (revision === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && revision.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (revision.branch_type !== "revision") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only revision branches can be rebased onto their source",
    });
  }

  if (revision.head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Revision has no commits — save at least one version before rebasing",
    });
  }

  if (revision.source_head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Source variant has no commits — cannot rebase",
    });
  }

  if (revision.source_commit_id === revision.source_head_commit_id) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Source has not advanced since this revision was forked — rebase is not needed. Use merge instead.",
    });
  }

  // Read the revision's HEAD content — we want to preserve the revision's changes.
  const revisionCommitRow = await db
    .selectFrom("resume_commits")
    .select(["tree_id"])
    .where("id", "=", revision.head_commit_id)
    .executeTakeFirst();

  if (revisionCommitRow === undefined || !revisionCommitRow.tree_id) {
    throw new ORPCError("BAD_REQUEST", { message: "Revision HEAD commit has no content tree" });
  }

  const revisionContent = await readTreeContent(db, revisionCommitRow.tree_id);

  const updatedBranch = await db.transaction().execute(async (trx) => {
    const treeId = await buildCommitTree(
      trx,
      revision.resume_id,
      revision.employee_id,
      revisionContent,
      revisionCommitRow.tree_id,
    );

    const newCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: revision.resume_id,
        tree_id: treeId,
        title: "Rebase revision onto source",
        description:
          "Revision content carried forward onto the latest source version. Merge is now unblocked.",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Parent #0: source HEAD — the new commit sits logically on top of source.
    await trx
      .insertInto("resume_commit_parents")
      .values({
        commit_id: newCommit.id,
        parent_commit_id: revision.source_head_commit_id!,
        parent_order: 0,
      })
      .execute();

    const updated = await trx
      .updateTable("resume_branches")
      .set({
        head_commit_id: newCommit.id,
        source_commit_id: revision.source_head_commit_id!,
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
    isArchived: updatedBranch.is_archived,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const rebaseRevisionOntoSourceHandler = implement(
  contract.rebaseRevisionOntoSource,
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return rebaseRevisionOntoSource(getDb(), user, input);
});

export function createRebaseRevisionOntoSourceHandler(db: Kysely<Database>) {
  return implement(contract.rebaseRevisionOntoSource).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return rebaseRevisionOntoSource(db, user, input);
    },
  );
}
