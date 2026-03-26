import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { mapWorkflowRow, mapStepRow } from "../lib/map-to-output.js";
import { fetchWorkflowWithSteps } from "../lib/query-helpers.js";
import type { ResumeRevisionWorkflow, ResumeRevisionStepSection } from "@cv-tool/contracts";

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

  // Reuse an existing active workflow for the same resume + base branch.
  // This prevents duplicate in-progress revisions against the same branch.
  const existingActiveWorkflow = await db
    .selectFrom("resume_revision_workflows")
    .select(["id"])
    .where("resume_id", "=", input.resumeId)
    .where("base_branch_id", "=", input.baseBranchId)
    .where("status", "=", "active")
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  if (existingActiveWorkflow !== undefined) {
    return fetchWorkflowWithSteps(db, user, existingActiveWorkflow.id);
  }

  // Load head commit content to derive skill categories
  const branchWithCommit = await db
    .selectFrom("resume_branches as rb")
    .leftJoin("resume_commits as rc", "rc.id", "rb.head_commit_id")
    .select(["rb.head_commit_id", "rc.content"])
    .where("rb.id", "=", input.baseBranchId)
    .executeTakeFirst();

  const commitContent = branchWithCommit?.content as import("../../../db/types.js").ResumeCommitContent | null | undefined;
  const skillCategories: string[] = commitContent?.skills
    ? [...new Set(commitContent.skills.map((s) => s.category ?? "Okategoriserad"))].sort()
    : [];

  const assignments = (commitContent?.assignments ?? []).filter((a) => !!a.assignmentId);

  const SECTIONS_BEFORE_SKILLS = ["discovery", "consultant_title", "presentation_summary"] as const;
  const SECTIONS_AFTER_ASSIGNMENTS = ["highlighted_experience", "consistency_polish"] as const;

  const stepDefinitions: Array<{ section: string; section_detail: string | null; step_order: number }> = [];
  let order = 0;

  for (const section of SECTIONS_BEFORE_SKILLS) {
    stepDefinitions.push({ section, section_detail: null, step_order: order++ });
  }

  // One step per skill category
  for (const category of skillCategories) {
    stepDefinitions.push({ section: "skills", section_detail: category, step_order: order++ });
  }
  // One step for suggesting new categories (always added)
  stepDefinitions.push({ section: "skills", section_detail: "__new_categories__", step_order: order++ });

  // One step per assignment, keyed by assignmentId with clientName encoded for display.
  // Format: "<assignmentId>|||<clientName>" — parsed in extractor and checklist.
  // Falls back to a single generic step if the branch has no assignments yet.
  if (assignments.length > 0) {
    for (const a of assignments) {
      stepDefinitions.push({
        section: "assignments",
        section_detail: `${a.assignmentId}|||${a.clientName}`,
        step_order: order++,
      });
    }
  } else {
    stepDefinitions.push({ section: "assignments", section_detail: null, step_order: order++ });
  }

  for (const section of SECTIONS_AFTER_ASSIGNMENTS) {
    stepDefinitions.push({ section, section_detail: null, step_order: order++ });
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
        stepDefinitions.map((def) => ({
          workflow_id: wf.id,
          section: def.section as ResumeRevisionStepSection,
          section_detail: def.section_detail,
          step_order: def.step_order,
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
