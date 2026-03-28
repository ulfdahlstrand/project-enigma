import { z } from "zod";

// ---------------------------------------------------------------------------
// Resume versioning schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
// Models git-inspired versioning concepts in plain language:
//   resume_commit  → a saved version (immutable snapshot)
//   resume_branch  → a variant (named line of development)
//   branch_assignment → per-variant assignment linking
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Commit content — the JSONB snapshot shape
// ---------------------------------------------------------------------------

export const resumeCommitSkillSchema = z.object({
  name: z.string(),
  level: z.string().nullable(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

export const resumeCommitAssignmentSchema = z.object({
  assignmentId: z.string(),
  clientName: z.string(),
  role: z.string(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  technologies: z.array(z.string()),
  isCurrent: z.boolean(),
  keywords: z.string().nullable(),
  type: z.string().nullable(),
  highlight: z.boolean(),
  sortOrder: z.number().nullable(),
});

export const resumeCommitContentSchema = z.object({
  title: z.string(),
  consultantTitle: z.string().nullable(),
  presentation: z.array(z.string()),
  summary: z.string().nullable(),
  language: z.string(),
  skills: z.array(resumeCommitSkillSchema),
  assignments: z.array(resumeCommitAssignmentSchema),
});

export type ResumeCommitContent = z.infer<typeof resumeCommitContentSchema>;

// ---------------------------------------------------------------------------
// ResumeCommit — a saved version
// ---------------------------------------------------------------------------

export const resumeCommitSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  parentCommitId: z.string().uuid().nullable(),
  content: resumeCommitContentSchema,
  message: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.union([z.string(), z.date()]),
});

export type ResumeCommit = z.infer<typeof resumeCommitSchema>;

// ---------------------------------------------------------------------------
// ResumeBranch — a variant
// ---------------------------------------------------------------------------

export const resumeBranchSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  name: z.string(),
  language: z.string(),
  isMain: z.boolean(),
  headCommitId: z.string().uuid().nullable(),
  forkedFromCommitId: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.union([z.string(), z.date()]),
});

export type ResumeBranch = z.infer<typeof resumeBranchSchema>;

// ---------------------------------------------------------------------------
// BranchAssignment — per-variant assignment link
// ---------------------------------------------------------------------------

export const branchAssignmentSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  highlight: z.boolean(),
  sortOrder: z.number().nullable(),
});

export type BranchAssignment = z.infer<typeof branchAssignmentSchema>;

// ---------------------------------------------------------------------------
// saveResumeVersion schemas
// ---------------------------------------------------------------------------

export const saveResumeVersionInputSchema = z.object({
  branchId: z.string().uuid(),
  message: z.string().optional(),
  /** Optional content overrides — when provided, these values are stored in the
   *  commit instead of reading from the live resume record. Use this when saving
   *  branch-specific edits without touching the main resume. */
  consultantTitle: z.string().nullable().optional(),
  presentation: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
});

export const saveResumeVersionOutputSchema = resumeCommitSchema;

// ---------------------------------------------------------------------------
// getResumeCommit schemas
// ---------------------------------------------------------------------------

export const getResumeCommitInputSchema = z.object({
  commitId: z.string().uuid(),
});

export const getResumeCommitOutputSchema = resumeCommitSchema;

// ---------------------------------------------------------------------------
// listResumeCommits schemas
//
// Returns a lightweight summary per commit (no content JSONB) for use in
// history lists. Use getResumeCommit to fetch full content for a single entry.
// ---------------------------------------------------------------------------

export const resumeCommitSummarySchema = resumeCommitSchema.omit({ content: true });

export type ResumeCommitSummary = z.infer<typeof resumeCommitSummarySchema>;

export const listResumeCommitsInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const listResumeCommitsOutputSchema = z.array(resumeCommitSummarySchema);

// ---------------------------------------------------------------------------
// forkResumeBranch schemas
//
// Creates a new branch forked from a specific commit. The new branch's HEAD
// starts at the forked commit (inheriting its full resume snapshot), and its
// branch_assignments are copied from the source branch.
// ---------------------------------------------------------------------------

export const forkResumeBranchInputSchema = z.object({
  fromCommitId: z.string().uuid(),
  name: z.string().min(1),
});

export const forkResumeBranchOutputSchema = resumeBranchSchema;

// ---------------------------------------------------------------------------
// listResumeBranches schemas
// ---------------------------------------------------------------------------

export const listResumeBranchesInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const listResumeBranchesOutputSchema = z.array(resumeBranchSchema);

// ---------------------------------------------------------------------------
// getResumeBranchHistoryGraph schemas
// ---------------------------------------------------------------------------

export const getResumeBranchHistoryGraphInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const resumeCommitGraphEdgeSchema = z.object({
  commitId: z.string().uuid(),
  parentCommitId: z.string().uuid(),
  parentOrder: z.number().int(),
});

export const resumeBranchHistoryGraphSchema = z.object({
  branches: z.array(resumeBranchSchema),
  commits: z.array(resumeCommitSummarySchema),
  edges: z.array(resumeCommitGraphEdgeSchema),
});

export const getResumeBranchHistoryGraphOutputSchema = resumeBranchHistoryGraphSchema;

export type ResumeBranchHistoryGraph = z.infer<typeof resumeBranchHistoryGraphSchema>;

// ---------------------------------------------------------------------------
// Diff engine schemas
//
// Used by compareResumeCommits to describe what changed between two commits.
// ---------------------------------------------------------------------------

export const diffStatusSchema = z.enum(["added", "removed", "modified", "unchanged"]);

export type DiffStatus = z.infer<typeof diffStatusSchema>;

/** A single field that changed: the value before and after. */
function fieldChange<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ before: schema, after: schema });
}

/** Scalar fields that may have changed between two commits. Only present when changed. */
export const resumeDiffScalarsSchema = z.object({
  title: fieldChange(z.string()).optional(),
  consultantTitle: fieldChange(z.string().nullable()).optional(),
  presentation: fieldChange(z.array(z.string())).optional(),
  summary: fieldChange(z.string().nullable()).optional(),
  language: fieldChange(z.string()).optional(),
});

export type ResumeDiffScalars = z.infer<typeof resumeDiffScalarsSchema>;

/** Diff entry for a single skill (keyed by name). */
export const skillDiffEntrySchema = z.object({
  status: diffStatusSchema,
  name: z.string(),
  before: resumeCommitSkillSchema.optional(),
  after: resumeCommitSkillSchema.optional(),
});

export type SkillDiffEntry = z.infer<typeof skillDiffEntrySchema>;

/** Diff entry for a single assignment (keyed by assignmentId). */
export const assignmentDiffEntrySchema = z.object({
  status: diffStatusSchema,
  assignmentId: z.string().uuid(),
  before: resumeCommitAssignmentSchema.optional(),
  after: resumeCommitAssignmentSchema.optional(),
});

export type AssignmentDiffEntry = z.infer<typeof assignmentDiffEntrySchema>;

/** Full structural diff between two resume commit snapshots. */
export const resumeDiffSchema = z.object({
  scalars: resumeDiffScalarsSchema,
  skills: z.array(skillDiffEntrySchema),
  assignments: z.array(assignmentDiffEntrySchema),
  hasChanges: z.boolean(),
});

export type ResumeDiff = z.infer<typeof resumeDiffSchema>;

// ---------------------------------------------------------------------------
// compareResumeCommits schemas
// ---------------------------------------------------------------------------

export const compareResumeCommitsInputSchema = z.object({
  baseCommitId: z.string().uuid(),
  headCommitId: z.string().uuid(),
});

export const compareResumeCommitsOutputSchema = z.object({
  baseCommitId: z.string().uuid(),
  headCommitId: z.string().uuid(),
  diff: resumeDiffSchema,
});

export type CompareResumeCommitsOutput = z.infer<typeof compareResumeCommitsOutputSchema>;
