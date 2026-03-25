import { z } from "zod";

// ---------------------------------------------------------------------------
// Resume Revision Workflow — Zod schemas and oRPC I/O types
//
// A guided, AI-assisted workflow that revises a resume section by section.
// Each workflow is tied to a base branch and gets its own revision branch
// where approved sections are committed one at a time.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const resumeRevisionWorkflowStatusSchema = z.enum([
  "active",
  "completed",
  "abandoned",
]);
export type ResumeRevisionWorkflowStatus = z.infer<typeof resumeRevisionWorkflowStatusSchema>;

export const resumeRevisionStepSectionSchema = z.enum([
  "discovery",
  "consultant_title",
  "presentation_summary",
  "skills",
  "assignments",
  "highlighted_experience",
  "consistency_polish",
]);
export type ResumeRevisionStepSection = z.infer<typeof resumeRevisionStepSectionSchema>;

export const resumeRevisionStepStatusSchema = z.enum([
  "pending",
  "generating",
  "reviewing",
  "approved",
  "needs_rework",
]);
export type ResumeRevisionStepStatus = z.infer<typeof resumeRevisionStepStatusSchema>;

// ---------------------------------------------------------------------------
// Entity schemas
// ---------------------------------------------------------------------------

/**
 * Structured payload carried by proposal messages.
 * Stored in resume_revision_messages.structured_content (JSONB).
 */
export const resumeRevisionProposalContentSchema = z.object({
  originalContent: z.unknown().nullable(),
  proposedContent: z.unknown().nullable(),
  reasoning: z.string().nullable(),
  changeSummary: z.string().nullable(),
});
export type ResumeRevisionProposalContent = z.infer<typeof resumeRevisionProposalContentSchema>;

export const resumeRevisionMessageSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  /** "text" for plain replies; "proposal" for AI-generated section proposals. */
  messageType: z.enum(["text", "proposal"]),
  content: z.string(),
  /** Non-null on proposal messages — carries the structured diff payload. */
  structuredContent: resumeRevisionProposalContentSchema.nullable(),
  createdAt: z.union([z.string(), z.date()]),
});
export type ResumeRevisionMessage = z.infer<typeof resumeRevisionMessageSchema>;

/**
 * Typed output stored when the discovery step is approved.
 * Passed as context to every subsequent step's AI prompt.
 */
export const resumeRevisionDiscoveryOutputSchema = z.object({
  targetRole: z.string(),
  tone: z.string(),
  strengthsToEmphasise: z.array(z.string()),
  thingsToDownplay: z.array(z.string()),
  languagePreferences: z.string(),
  additionalNotes: z.string(),
});
export type ResumeRevisionDiscoveryOutput = z.infer<typeof resumeRevisionDiscoveryOutputSchema>;

export const resumeRevisionWorkflowStepSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  section: resumeRevisionStepSectionSchema,
  sectionDetail: z.string().nullable(),
  stepOrder: z.number().int(),
  status: resumeRevisionStepStatusSchema,
  /** Points to the proposal message the user accepted (mirrors a GitHub issue closing reference). */
  approvedMessageId: z.string().uuid().nullable(),
  /** Commit written to the revision branch when this step is approved. */
  commitId: z.string().uuid().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  messages: z.array(resumeRevisionMessageSchema),
});
export type ResumeRevisionWorkflowStep = z.infer<typeof resumeRevisionWorkflowStepSchema>;

export const resumeRevisionWorkflowSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  baseBranchId: z.string().uuid(),
  revisionBranchId: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  status: resumeRevisionWorkflowStatusSchema,
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  steps: z.array(resumeRevisionWorkflowStepSchema),
});
export type ResumeRevisionWorkflow = z.infer<typeof resumeRevisionWorkflowSchema>;

// ---------------------------------------------------------------------------
// createResumeRevisionWorkflow
// ---------------------------------------------------------------------------

export const createResumeRevisionWorkflowInputSchema = z.object({
  resumeId: z.string().uuid(),
  baseBranchId: z.string().uuid(),
});

export const createResumeRevisionWorkflowOutputSchema = resumeRevisionWorkflowSchema;

// ---------------------------------------------------------------------------
// getResumeRevisionWorkflow
// ---------------------------------------------------------------------------

export const getResumeRevisionWorkflowInputSchema = z.object({
  workflowId: z.string().uuid(),
});

export const getResumeRevisionWorkflowOutputSchema = resumeRevisionWorkflowSchema;

// ---------------------------------------------------------------------------
// listResumeRevisionWorkflows
// ---------------------------------------------------------------------------

export const listResumeRevisionWorkflowsInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const listResumeRevisionWorkflowsOutputSchema = z.array(
  resumeRevisionWorkflowSchema.omit({ steps: true }).extend({
    activeStepSection: resumeRevisionStepSectionSchema.nullable(),
  })
);

// ---------------------------------------------------------------------------
// sendResumeRevisionMessage
// ---------------------------------------------------------------------------

export const sendResumeRevisionMessageInputSchema = z.object({
  stepId: z.string().uuid(),
  content: z.string().min(1),
  locale: z.string().optional(),
});

export const sendResumeRevisionMessageOutputSchema = z.object({
  userMessage: resumeRevisionMessageSchema,
  assistantMessage: resumeRevisionMessageSchema,
  /** Updated step with latest result if the AI produced a new proposal. */
  step: resumeRevisionWorkflowStepSchema,
});

// ---------------------------------------------------------------------------
// approveRevisionStep
// ---------------------------------------------------------------------------

export const approveRevisionStepInputSchema = z.object({
  stepId: z.string().uuid(),
});

export const approveRevisionStepOutputSchema = z.object({
  step: resumeRevisionWorkflowStepSchema,
  /** The workflow, reflecting any status change (e.g. completed). */
  workflow: resumeRevisionWorkflowSchema,
});

// ---------------------------------------------------------------------------
// requestRevisionStepRework
// ---------------------------------------------------------------------------

export const requestRevisionStepReworkInputSchema = z.object({
  stepId: z.string().uuid(),
  feedback: z.string().optional(),
});

export const requestRevisionStepReworkOutputSchema = z.object({
  step: resumeRevisionWorkflowStepSchema,
});

// ---------------------------------------------------------------------------
// kickoffRevisionStep
// ---------------------------------------------------------------------------

export const kickoffRevisionStepInputSchema = z.object({
  stepId: z.string().uuid(),
  locale: z.string().optional(),
});

export const kickoffRevisionStepOutputSchema = z.object({
  assistantMessage: resumeRevisionMessageSchema,
  step: resumeRevisionWorkflowStepSchema,
});

// ---------------------------------------------------------------------------
// skipRevisionStep
// ---------------------------------------------------------------------------

export const skipRevisionStepInputSchema = z.object({
  stepId: z.string().uuid(),
});

export const skipRevisionStepOutputSchema = z.object({
  step: resumeRevisionWorkflowStepSchema,
  workflow: resumeRevisionWorkflowSchema,
});

// ---------------------------------------------------------------------------
// finaliseResumeRevision
// ---------------------------------------------------------------------------

export const finaliseResumeRevisionInputSchema = z.object({
  workflowId: z.string().uuid(),
  /** merge: fast-forward revision commits onto the base branch.
   *  keep:  leave the revision branch as a standalone branch. */
  action: z.enum(["merge", "keep"]),
});

export const finaliseResumeRevisionOutputSchema = z.object({
  workflow: resumeRevisionWorkflowSchema,
  /** The branch the result was applied to (base branch for merge, revision branch for keep). */
  resultBranchId: z.string().uuid(),
});
