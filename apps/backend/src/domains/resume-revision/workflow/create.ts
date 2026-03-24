import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { STEP_SECTIONS } from "../lib/step-sections.js";
import { mapWorkflowRow, mapStepRow } from "../lib/map-to-output.js";
import type { ResumeRevisionWorkflow } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// createResumeRevisionWorkflow — query logic
// ---------------------------------------------------------------------------

export async function createResumeRevisionWorkflow(
  db: Kysely<Database>,
  user: AuthUser,
  input: { resumeId: string; baseBranchId: string }
): Promise<ResumeRevisionWorkflow> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify base branch belongs to the resume and user owns it
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["rb.id", "r.employee_id"])
    .where("rb.id", "=", input.baseBranchId)
    .where("rb.resume_id", "=", input.resumeId)
    .executeTakeFirst();

  if (branch === undefined) throw new ORPCError("NOT_FOUND");
  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const { workflow, steps } = await db.transaction().execute(async (trx) => {
    const wf = await trx
      .insertInto("resume_revision_workflows")
      .values({
        resume_id: input.resumeId,
        base_branch_id: input.baseBranchId,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const stepRows = await trx
      .insertInto("resume_revision_workflow_steps")
      .values(
        STEP_SECTIONS.map((section, idx) => ({
          workflow_id: wf.id,
          section,
          step_order: idx,
        }))
      )
      .returningAll()
      .execute();

    return { workflow: wf, steps: stepRows };
  });

  const mappedSteps = steps
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => mapStepRow(s, []));

  return mapWorkflowRow(workflow, mappedSteps);
}

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

export const createResumeRevisionWorkflowHandler = implement(
  contract.createResumeRevisionWorkflow
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return createResumeRevisionWorkflow(getDb(), user, input);
});

export function createCreateResumeRevisionWorkflowHandler(db: Kysely<Database>) {
  return implement(contract.createResumeRevisionWorkflow).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createResumeRevisionWorkflow(db, user, input);
    }
  );
}
