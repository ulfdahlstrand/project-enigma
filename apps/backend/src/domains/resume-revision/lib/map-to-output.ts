import type {
  ResumeRevisionWorkflow,
  ResumeRevisionWorkflowStep,
  ResumeRevisionMessage,
  ResumeRevisionWorkflowStatus,
  ResumeRevisionStepSection,
  ResumeRevisionStepStatus,
  ResumeRevisionProposalContent,
} from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Row types (minimal shapes returned from Kysely selects)
// ---------------------------------------------------------------------------

export interface WorkflowRow {
  id: string;
  resume_id: string;
  base_branch_id: string;
  revision_branch_id: string | null;
  created_by: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface StepRow {
  id: string;
  workflow_id: string;
  section: string;
  section_detail: string | null;
  step_order: number;
  status: string;
  approved_message_id: string | null;
  commit_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  step_id: string;
  role: string;
  message_type: string;
  content: string;
  structured_content: unknown;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapMessageRow(row: MessageRow): ResumeRevisionMessage {
  return {
    id: row.id,
    stepId: row.step_id,
    role: row.role as "user" | "assistant",
    messageType: row.message_type as "text" | "proposal",
    content: row.content,
    structuredContent: row.structured_content as ResumeRevisionProposalContent | null,
    createdAt: row.created_at,
  };
}

export function mapStepRow(
  row: StepRow,
  messages: ResumeRevisionMessage[]
): ResumeRevisionWorkflowStep {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    section: row.section as ResumeRevisionStepSection,
    sectionDetail: row.section_detail,
    stepOrder: row.step_order,
    status: row.status as ResumeRevisionStepStatus,
    approvedMessageId: row.approved_message_id,
    commitId: row.commit_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  };
}

export function mapWorkflowRow(
  row: WorkflowRow,
  steps: ResumeRevisionWorkflowStep[]
): ResumeRevisionWorkflow {
  return {
    id: row.id,
    resumeId: row.resume_id,
    baseBranchId: row.base_branch_id,
    revisionBranchId: row.revision_branch_id,
    createdBy: row.created_by,
    status: row.status as ResumeRevisionWorkflowStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps,
  };
}
