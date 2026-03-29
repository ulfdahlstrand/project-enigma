import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { fetchWorkflowWithSteps } from "../lib/query-helpers.js";
import type { ResumeRevisionWorkflow } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// getResumeRevisionWorkflow — query logic
// ---------------------------------------------------------------------------

export async function getResumeRevisionWorkflow(
  db: Kysely<Database>,
  user: AuthUser,
  input: { workflowId: string }
): Promise<ResumeRevisionWorkflow> {
  return fetchWorkflowWithSteps(db, user, input.workflowId);
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const getResumeRevisionWorkflowHandler = implement(
  contract.getResumeRevisionWorkflow
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return getResumeRevisionWorkflow(getDb(), user, input);
});
