import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import {
  fetchStepWithAuth,
  fetchWorkflowWithSteps,
} from "../lib/query-helpers.js";

// ---------------------------------------------------------------------------
// skipRevisionStep — query logic
// ---------------------------------------------------------------------------

export async function skipRevisionStep(
  db: Kysely<Database>,
  user: AuthUser,
  input: { stepId: string }
) {
  const step = await fetchStepWithAuth(db, user, input.stepId);

  if (step.status === "approved") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Step is already "approved" and cannot be skipped.`,
    });
  }

  const workflowId = step.workflow_id;

  await db.transaction().execute(async (trx) => {
    // Mark step as approved with no message or commit (skipped)
    await trx
      .updateTable("resume_revision_workflow_steps")
      .set({
        status: "approved",
        approved_message_id: null,
        commit_id: null,
        updated_at: new Date(),
      })
      .where("id", "=", step.id)
      .execute();

    // Check if all other steps are now approved — if so, complete the workflow
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
  const skippedStep = workflow.steps.find((s) => s.id === step.id);
  if (skippedStep === undefined) throw new ORPCError("INTERNAL_SERVER_ERROR");

  return { step: skippedStep, workflow };
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const skipRevisionStepHandler = implement(
  contract.skipRevisionStep
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return skipRevisionStep(getDb(), user, input);
});

export function createSkipRevisionStepHandler(db: Kysely<Database>) {
  return implement(contract.skipRevisionStep).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return skipRevisionStep(db, user, input);
    }
  );
}
