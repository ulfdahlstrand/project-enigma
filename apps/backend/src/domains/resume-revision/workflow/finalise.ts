import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../../ai/lib/openai-client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { fetchWorkflowWithAuth, fetchWorkflowWithSteps } from "../lib/query-helpers.js";
import {
  syncBranchAssignmentsFromContent,
  normaliseAssignmentIds,
} from "../lib/sync-branch-assignments.js";
import { generateMergeCommitMessage } from "../lib/haiku-helpers.js";

// ---------------------------------------------------------------------------
// finaliseResumeRevision — query logic
// ---------------------------------------------------------------------------

export async function finaliseResumeRevision(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  user: AuthUser,
  input: { workflowId: string; action: "merge" | "keep" }
) {
  const workflowRow = await fetchWorkflowWithAuth(db, user, input.workflowId);

  if (workflowRow.status !== "completed") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Workflow must be completed before finalising.",
    });
  }

  if (input.action === "keep") {
    // Sync branch_assignments for the revision branch so it's queryable
    if (workflowRow.revision_branch_id !== null) {
      const revCommit = await db
        .selectFrom("resume_branches as rb")
        .innerJoin("resume_commits as rc", "rc.id", "rb.head_commit_id")
        .select(["rc.id as commit_id", "rc.content"])
        .where("rb.id", "=", workflowRow.revision_branch_id)
        .executeTakeFirst();
      if (revCommit) {
        const normalisedContent = await normaliseAssignmentIds(
          db,
          workflowRow.employee_id,
          revCommit.content as ResumeCommitContent
        );
        if (normalisedContent !== (revCommit.content as ResumeCommitContent)) {
          await db
            .updateTable("resume_commits")
            .set({ content: JSON.stringify(normalisedContent) })
            .where("id", "=", revCommit.commit_id)
            .execute();
        }
        await syncBranchAssignmentsFromContent(
          db,
          workflowRow.revision_branch_id,
          normalisedContent
        );
      }
    }
    await db
      .updateTable("resume_revision_workflows")
      .set({ status: "finalized", updated_at: new Date() })
      .where("id", "=", input.workflowId)
      .execute();

    const workflow = await fetchWorkflowWithSteps(db, user, input.workflowId);
    return {
      workflow,
      resultBranchId: workflowRow.revision_branch_id ?? workflowRow.base_branch_id,
    };
  }

  // action === "merge": copy revision branch HEAD content onto the base branch
  if (workflowRow.revision_branch_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "No revision branch exists — nothing to merge.",
    });
  }

  const revisionBranch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", workflowRow.revision_branch_id)
    .executeTakeFirst();

  if (revisionBranch?.head_commit_id === undefined) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Revision branch has no HEAD commit.",
    });
  }

  const revisionCommit = await db
    .selectFrom("resume_commits")
    .select(["content"])
    .where("id", "=", revisionBranch.head_commit_id)
    .executeTakeFirst();

  if (revisionCommit === undefined) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Revision HEAD commit not found.",
    });
  }

  const baseBranch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", workflowRow.base_branch_id)
    .executeTakeFirst();
  const baseParentCommitId = baseBranch?.head_commit_id ?? null;

  const normalisedContent = await normaliseAssignmentIds(
    db,
    workflowRow.employee_id,
    revisionCommit.content as ResumeCommitContent
  );

  // Generate merge commit message via Haiku using revision branch commit messages
  const revisionCommitMessages = await db
    .selectFrom("resume_commits")
    .select(["message"])
    .where("branch_id", "=", workflowRow.revision_branch_id)
    .orderBy("created_at", "asc")
    .execute();

  const mergeMessage = await generateMergeCommitMessage(
    openaiClient,
    revisionCommitMessages.map((c) => c.message).filter(Boolean)
  );

  // Create a merge commit on the base branch
  await db.transaction().execute(async (trx) => {
    const mergeCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: workflowRow.resume_id,
        branch_id: workflowRow.base_branch_id,
        content: JSON.stringify(normalisedContent),
        message: mergeMessage,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const mergeParents = [
      baseParentCommitId !== null
        ? {
            commit_id: mergeCommit.id,
            parent_commit_id: baseParentCommitId,
            parent_order: 0,
          }
        : null,
      revisionBranch.head_commit_id !== null
        ? {
            commit_id: mergeCommit.id,
            parent_commit_id: revisionBranch.head_commit_id,
            parent_order: 1,
          }
        : null,
    ].filter((value): value is NonNullable<typeof value> => value !== null);

    if (mergeParents.length > 0) {
      await trx.insertInto("resume_commit_parents").values(mergeParents).execute();
    }

    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: mergeCommit.id })
      .where("id", "=", workflowRow.base_branch_id)
      .execute();

    await trx
      .updateTable("resume_revision_workflows")
      .set({ status: "finalized", updated_at: new Date() })
      .where("id", "=", input.workflowId)
      .execute();

    // Sync branch_assignments for the base branch to reflect merged content
    await syncBranchAssignmentsFromContent(
      trx,
      workflowRow.base_branch_id,
      normalisedContent
    );
  });

  const workflow = await fetchWorkflowWithSteps(db, user, input.workflowId);
  return { workflow, resultBranchId: workflowRow.base_branch_id };
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const finaliseResumeRevisionHandler = implement(
  contract.finaliseResumeRevision
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return finaliseResumeRevision(getDb(), getOpenAIClient(), user, input);
});

export function createFinaliseResumeRevisionHandler(
  db: Kysely<Database>,
  openaiClient: OpenAI
) {
  return implement(contract.finaliseResumeRevision).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return finaliseResumeRevision(db, openaiClient, user, input);
    }
  );
}
