import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import {
  fetchStepWithAuth,
  fetchWorkflowWithSteps,
} from "../lib/query-helpers.js";
import { applySectionContent } from "../lib/section-content-extractor.js";
import { normaliseAssignmentIds } from "../lib/sync-branch-assignments.js";
import { isDiscoverySection } from "../lib/step-sections.js";
import type { ResumeRevisionProposalContent, ResumeRevisionStepSection } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// approveRevisionStep — query logic
// ---------------------------------------------------------------------------

export async function approveRevisionStep(
  db: Kysely<Database>,
  user: AuthUser,
  input: { stepId: string }
) {
  const step = await fetchStepWithAuth(db, user, input.stepId);

  if (step.status !== "reviewing") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Can only approve a step that is in "reviewing" status. Current: "${step.status}".`,
    });
  }

  // Find the latest proposal message
  const proposalMessage = await db
    .selectFrom("resume_revision_messages")
    .selectAll()
    .where("step_id", "=", step.id)
    .where("message_type", "=", "proposal")
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  if (proposalMessage === undefined) {
    throw new ORPCError("BAD_REQUEST", {
      message: "No proposal message found. The AI must produce a proposal before approving.",
    });
  }

  const workflowId = step.workflow_id;
  const section = step.section as ResumeRevisionStepSection;
  const sectionDetail = step.section_detail as string | null ?? null;

  let newCommitId: string | null = null;
  let revisionBranchId = step.revision_branch_id;

  await db.transaction().execute(async (trx) => {
    // highlighted_experience: write proposed items to resume_highlighted_items
    if (section === "highlighted_experience") {
      const resumeId = await getResumeIdForWorkflow(trx, workflowId);
      const proposal = proposalMessage.structured_content as ResumeRevisionProposalContent | null;
      const items = (proposal?.proposedContent as { items?: string[] } | null)?.items;
      if (Array.isArray(items)) {
        await trx.deleteFrom("resume_highlighted_items").where("resume_id", "=", resumeId).execute();
        if (items.length > 0) {
          await trx
            .insertInto("resume_highlighted_items")
            .values(items.map((text, i) => ({ resume_id: resumeId, text, sort_order: i })))
            .execute();
        }
      }
    }

    // For other content sections, create a commit on the revision branch
    if (!isDiscoverySection(section) && section !== "highlighted_experience") {
      // Ensure revision branch exists; create it from base branch HEAD if not
      if (revisionBranchId === null) {
        revisionBranchId = await createRevisionBranch(trx, user, {
          workflowId,
          resumeId: (await getResumeIdForWorkflow(trx, workflowId))!,
          baseBranchId: step.base_branch_id,
        });
      }

      // Get revision branch HEAD content (or base branch HEAD if brand new)
      const baseContent = await loadBranchHeadContent(trx, revisionBranchId);
      const proposal = proposalMessage.structured_content as ResumeRevisionProposalContent | null;
      const proposedContent = proposal?.proposedContent ?? null;

      const rawContent = applySectionContent(section, baseContent, proposedContent, sectionDetail);
      const newContent = await normaliseAssignmentIds(trx, step.employee_id, rawContent);

      const revBranch = await trx
        .selectFrom("resume_branches")
        .select(["head_commit_id"])
        .where("id", "=", revisionBranchId)
        .executeTakeFirstOrThrow();

      const commit = await trx
        .insertInto("resume_commits")
        .values({
          resume_id: await getResumeIdForWorkflow(trx, workflowId),
          branch_id: revisionBranchId,
          content: JSON.stringify(newContent),
          message: `Approve ${section}`,
          created_by: user.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (revBranch.head_commit_id !== null) {
        await trx
          .insertInto("resume_commit_parents")
          .values({
            commit_id: commit.id,
            parent_commit_id: revBranch.head_commit_id,
            parent_order: 0,
          })
          .execute();
      }

      await trx
        .updateTable("resume_branches")
        .set({ head_commit_id: commit.id })
        .where("id", "=", revisionBranchId)
        .execute();

      newCommitId = commit.id;
    }

    // Update step: approved, record which message and commit
    await trx
      .updateTable("resume_revision_workflow_steps")
      .set({
        status: "approved",
        approved_message_id: proposalMessage.id,
        commit_id: newCommitId,
        updated_at: new Date(),
      })
      .where("id", "=", step.id)
      .execute();

    // Update workflow revision_branch_id if we just created one
    if (revisionBranchId !== step.revision_branch_id) {
      await trx
        .updateTable("resume_revision_workflows")
        .set({ revision_branch_id: revisionBranchId, updated_at: new Date() })
        .where("id", "=", workflowId)
        .execute();
    }

    // Check if all steps are now approved — if so, complete the workflow
    const pendingSteps = await trx
      .selectFrom("resume_revision_workflow_steps")
      .select(["id"])
      .where("workflow_id", "=", workflowId)
      .where("id", "!=", step.id)
      .where("status", "!=", "approved")
      .execute();

    if (pendingSteps.length === 0) {
      await trx
        .updateTable("resume_revision_workflows")
        .set({ status: "completed", updated_at: new Date() })
        .where("id", "=", workflowId)
        .execute();
    } else {
      await trx
        .updateTable("resume_revision_workflows")
        .set({ updated_at: new Date() })
        .where("id", "=", workflowId)
        .execute();
    }
  });

  const workflow = await fetchWorkflowWithSteps(db, user, workflowId);
  const approvedStep = workflow.steps.find((s) => s.id === step.id);
  if (approvedStep === undefined) throw new ORPCError("INTERNAL_SERVER_ERROR");

  return { step: approvedStep, workflow };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getResumeIdForWorkflow(
  db: Kysely<Database>,
  workflowId: string
): Promise<string> {
  const row = await db
    .selectFrom("resume_revision_workflows")
    .select(["resume_id"])
    .where("id", "=", workflowId)
    .executeTakeFirstOrThrow();
  return row.resume_id;
}

async function createRevisionBranch(
  db: Kysely<Database>,
  user: AuthUser,
  params: { workflowId: string; resumeId: string; baseBranchId: string }
): Promise<string> {
  const baseBranch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id", "language"])
    .where("id", "=", params.baseBranchId)
    .executeTakeFirstOrThrow();

  const branch = await db
    .insertInto("resume_branches")
    .values({
      resume_id: params.resumeId,
      name: `revision-${params.workflowId.slice(0, 8)}`,
      language: baseBranch.language,
      is_main: false,
      head_commit_id: baseBranch.head_commit_id,
      forked_from_commit_id: baseBranch.head_commit_id,
      created_by: user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return branch.id;
}

async function loadBranchHeadContent(
  db: Kysely<Database>,
  branchId: string
): Promise<ResumeCommitContent> {
  const branch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id"])
    .where("id", "=", branchId)
    .executeTakeFirstOrThrow();

  if (branch.head_commit_id === null) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Branch has no HEAD commit.",
    });
  }

  const commit = await db
    .selectFrom("resume_commits")
    .select(["content"])
    .where("id", "=", branch.head_commit_id)
    .executeTakeFirstOrThrow();

  return commit.content as ResumeCommitContent;
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const approveRevisionStepHandler = implement(
  contract.approveRevisionStep
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return approveRevisionStep(getDb(), user, input);
});

export function createApproveRevisionStepHandler(db: Kysely<Database>) {
  return implement(contract.approveRevisionStep).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return approveRevisionStep(db, user, input);
    }
  );
}
