import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { ORPCError } from "@orpc/server";
import type {
  ResumeRevisionWorkflowStatus,
  ResumeRevisionStepSection,
} from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// listResumeRevisionWorkflows — query logic
// ---------------------------------------------------------------------------

export async function listResumeRevisionWorkflows(
  db: Kysely<Database>,
  user: AuthUser,
  input: { resumeId: string }
) {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify resume ownership
  const resume = await db
    .selectFrom("resumes")
    .select(["id", "employee_id"])
    .where("id", "=", input.resumeId)
    .executeTakeFirst();

  if (resume === undefined) throw new ORPCError("NOT_FOUND");
  if (ownerEmployeeId !== null && resume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const workflows = await db
    .selectFrom("resume_revision_workflows")
    .selectAll()
    .where("resume_id", "=", input.resumeId)
    .orderBy("created_at", "desc")
    .execute();

  if (workflows.length === 0) return [];

  const workflowIds = workflows.map((w) => w.id);

  // Fetch all steps for these workflows to determine activeStepSection
  const steps = await db
    .selectFrom("resume_revision_workflow_steps")
    .select(["id", "workflow_id", "section", "step_order", "status"])
    .where("workflow_id", "in", workflowIds)
    .orderBy("step_order", "asc")
    .execute();

  const stepsByWorkflow = new Map<string, typeof steps>();
  for (const s of steps) {
    const list = stepsByWorkflow.get(s.workflow_id) ?? [];
    list.push(s);
    stepsByWorkflow.set(s.workflow_id, list);
  }

  return workflows.map((w) => {
    const wfSteps = stepsByWorkflow.get(w.id) ?? [];
    const activeStep = wfSteps.find((s) => s.status !== "approved");
    return {
      id: w.id,
      resumeId: w.resume_id,
      baseBranchId: w.base_branch_id,
      revisionBranchId: w.revision_branch_id,
      createdBy: w.created_by,
      status: w.status as ResumeRevisionWorkflowStatus,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      activeStepSection: (activeStep?.section as ResumeRevisionStepSection) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const listResumeRevisionWorkflowsHandler = implement(
  contract.listResumeRevisionWorkflows
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return listResumeRevisionWorkflows(getDb(), user, input);
});
