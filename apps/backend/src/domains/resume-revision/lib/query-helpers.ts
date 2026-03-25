import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import type { AuthUser } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import {
  mapWorkflowRow,
  mapStepRow,
  mapMessageRow,
  type WorkflowRow,
  type StepRow,
} from "./map-to-output.js";
import type {
  ResumeRevisionWorkflow,
  ResumeRevisionWorkflowStep,
  ResumeRevisionDiscoveryOutput,
} from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// fetchWorkflowWithAuth
// ---------------------------------------------------------------------------

/** Fetches a workflow row and checks ownership. Returns the workflow row. */
export async function fetchWorkflowWithAuth(
  db: Kysely<Database>,
  user: AuthUser,
  workflowId: string
): Promise<WorkflowRow & { employee_id: string }> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const row = await db
    .selectFrom("resume_revision_workflows as w")
    .innerJoin("resumes as r", "r.id", "w.resume_id")
    .select([
      "w.id",
      "w.resume_id",
      "w.base_branch_id",
      "w.revision_branch_id",
      "w.created_by",
      "w.status",
      "w.created_at",
      "w.updated_at",
      "r.employee_id",
    ])
    .where("w.id", "=", workflowId)
    .executeTakeFirst();

  if (row === undefined) throw new ORPCError("NOT_FOUND");
  if (ownerEmployeeId !== null && row.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return row;
}

// ---------------------------------------------------------------------------
// fetchStepWithAuth
// ---------------------------------------------------------------------------

export interface StepWithContext extends StepRow {
  workflow_id: string;
  resume_id: string;
  base_branch_id: string;
  revision_branch_id: string | null;
  workflow_status: string;
  employee_id: string;
}

/** Fetches a step row joined to its workflow and resume for ownership checks. */
export async function fetchStepWithAuth(
  db: Kysely<Database>,
  user: AuthUser,
  stepId: string
): Promise<StepWithContext> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const row = await db
    .selectFrom("resume_revision_workflow_steps as s")
    .innerJoin("resume_revision_workflows as w", "w.id", "s.workflow_id")
    .innerJoin("resumes as r", "r.id", "w.resume_id")
    .select([
      "s.id",
      "s.workflow_id",
      "s.section",
      "s.section_detail",
      "s.step_order",
      "s.status",
      "s.approved_message_id",
      "s.commit_id",
      "s.created_at",
      "s.updated_at",
      "w.resume_id",
      "w.base_branch_id",
      "w.revision_branch_id",
      "w.status as workflow_status",
      "r.employee_id",
    ])
    .where("s.id", "=", stepId)
    .executeTakeFirst();

  if (row === undefined) throw new ORPCError("NOT_FOUND");
  if (ownerEmployeeId !== null && row.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return row;
}

// ---------------------------------------------------------------------------
// fetchStepsWithMessages
// ---------------------------------------------------------------------------

/** Loads all steps with their messages for a workflow, ordered by step_order. */
export async function fetchStepsWithMessages(
  db: Kysely<Database>,
  workflowId: string
): Promise<ResumeRevisionWorkflowStep[]> {
  const stepRows = await db
    .selectFrom("resume_revision_workflow_steps")
    .selectAll()
    .where("workflow_id", "=", workflowId)
    .orderBy("step_order", "asc")
    .execute();

  if (stepRows.length === 0) return [];

  const stepIds = stepRows.map((s) => s.id);
  const messageRows = await db
    .selectFrom("resume_revision_messages")
    .selectAll()
    .where("step_id", "in", stepIds)
    .orderBy("created_at", "asc")
    .execute();

  const messagesByStep = new Map<string, typeof messageRows>();
  for (const m of messageRows) {
    const list = messagesByStep.get(m.step_id) ?? [];
    list.push(m);
    messagesByStep.set(m.step_id, list);
  }

  return stepRows.map((s) =>
    mapStepRow(s, (messagesByStep.get(s.id) ?? []).map(mapMessageRow))
  );
}

// ---------------------------------------------------------------------------
// fetchWorkflowWithSteps
// ---------------------------------------------------------------------------

/** Fetches a full workflow (with auth) including all steps and messages. */
export async function fetchWorkflowWithSteps(
  db: Kysely<Database>,
  user: AuthUser,
  workflowId: string
): Promise<ResumeRevisionWorkflow> {
  const workflowRow = await fetchWorkflowWithAuth(db, user, workflowId);
  const steps = await fetchStepsWithMessages(db, workflowId);
  return mapWorkflowRow(workflowRow, steps);
}

// ---------------------------------------------------------------------------
// fetchDiscoveryOutput
// ---------------------------------------------------------------------------

/**
 * Returns the structured discovery output from the approved discovery step
 * message. Returns null if the discovery step has not been approved yet.
 */
export async function fetchDiscoveryOutput(
  db: Kysely<Database>,
  workflowId: string
): Promise<ResumeRevisionDiscoveryOutput | null> {
  const row = await db
    .selectFrom("resume_revision_workflow_steps as s")
    .innerJoin(
      "resume_revision_messages as m",
      "m.id",
      "s.approved_message_id"
    )
    .select(["m.structured_content"])
    .where("s.workflow_id", "=", workflowId)
    .where("s.section", "=", "discovery")
    .executeTakeFirst();

  if (row === undefined || row.structured_content === null) return null;

  const payload = row.structured_content as {
    proposedContent?: ResumeRevisionDiscoveryOutput;
  };
  return payload.proposedContent ?? null;
}
