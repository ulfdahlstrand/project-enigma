import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import {
  fetchStepWithAuth,
  fetchStepsWithMessages,
} from "../lib/query-helpers.js";
import { mapStepRow } from "../lib/map-to-output.js";

// ---------------------------------------------------------------------------
// requestRevisionStepRework — query logic
// ---------------------------------------------------------------------------

export async function requestRevisionStepRework(
  db: Kysely<Database>,
  user: AuthUser,
  input: { stepId: string; feedback?: string | undefined }
) {
  const step = await fetchStepWithAuth(db, user, input.stepId);

  if (step.status !== "reviewing") {
    throw new ORPCError("BAD_REQUEST", {
      message: `Can only request rework on a step that is in "reviewing" status. Current: "${step.status}".`,
    });
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("resume_revision_workflow_steps")
      .set({ status: "needs_rework", updated_at: new Date() })
      .where("id", "=", step.id)
      .execute();

    // If feedback is provided, persist it as a user message so the AI
    // sees it in context during the next sendResumeRevisionMessage call.
    if (input.feedback !== undefined && input.feedback.trim() !== "") {
      await trx
        .insertInto("resume_revision_messages")
        .values({
          step_id: step.id,
          role: "user",
          content: input.feedback,
        })
        .execute();
    }
  });

  const allMessages = await fetchStepsWithMessages(db, step.workflow_id);
  const updatedStep = allMessages.find((s) => s.id === step.id);
  if (updatedStep === undefined) throw new ORPCError("INTERNAL_SERVER_ERROR");

  return { step: updatedStep };
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const requestRevisionStepReworkHandler = implement(
  contract.requestRevisionStepRework
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return requestRevisionStepRework(getDb(), user, input);
});

export function createRequestRevisionStepReworkHandler(db: Kysely<Database>) {
  return implement(contract.requestRevisionStepRework).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return requestRevisionStepRework(db, user, input);
    }
  );
}
