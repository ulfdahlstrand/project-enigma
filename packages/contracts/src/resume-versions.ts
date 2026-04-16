import { z } from "zod";
import { educationTypeSchema } from "./education.js";

// ---------------------------------------------------------------------------
// Resume versioning schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
// Models git-inspired versioning concepts in plain language:
//   resume_commit  → a saved version (immutable snapshot)
//   resume_branch  → a variant (named line of development)
//   branch assignment views → branch-scoped assignment content from commits
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Commit content — the JSONB snapshot shape
// ---------------------------------------------------------------------------

export const resumeCommitSkillGroupSchema = z.object({
  name: z.string(),
  sortOrder: z.number(),
});

export const resumeCommitSkillSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

export const resumeCommitAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
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

export const resumeCommitEducationSchema = z.object({
  type: educationTypeSchema,
  value: z.string(),
  sortOrder: z.number(),
});

export const resumeCommitContentSchema = z.object({
  title: z.string(),
  consultantTitle: z.string().nullable(),
  presentation: z.array(z.string()),
  summary: z.string().nullable(),
  highlightedItems: z.array(z.string()).default([]),
  language: z.string(),
  education: z.array(resumeCommitEducationSchema).default([]),
  skillGroups: z.array(resumeCommitSkillGroupSchema).default([]),
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
  parentCommitId: z.string().uuid().nullable(),
  content: resumeCommitContentSchema,
  title: z.string(),
  description: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.union([z.string(), z.date()]),
});

export type ResumeCommit = z.infer<typeof resumeCommitSchema>;

// ---------------------------------------------------------------------------
// ResumeBranch — a variant, translation, or revision
// ---------------------------------------------------------------------------

export const branchTypeSchema = z.enum(["variant", "translation", "revision"]);
export type BranchType = z.infer<typeof branchTypeSchema>;

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
  /** Classifies the branch as 'variant', 'translation', or 'revision'. */
  branchType: branchTypeSchema,
  /**
   * For translation/revision branches: ID of the source variant.
   * NULL for variants.
   */
  sourceBranchId: z.string().uuid().nullable(),
  /**
   * For translations: the source commit the translation is caught up to (mutable).
   * For revisions: the commit the revision diverged from (immutable).
   * NULL for variants.
   */
  sourceCommitId: z.string().uuid().nullable(),
  /**
   * True when this is a translation and source_commit_id differs from the
   * source variant's head_commit_id. Always false for variants and revisions.
   */
  isStale: z.boolean(),
  /** True when the branch has been soft-archived (hidden by default). */
  isArchived: z.boolean(),
});

export type ResumeBranch = z.infer<typeof resumeBranchSchema>;

// ---------------------------------------------------------------------------
// BranchAssignment — branch-scoped assignment view item
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
  title: z.string().optional(),
  /** Optional extended description for this commit. */
  description: z.string().optional(),
  /** Optional content overrides — when provided, these values are stored in the
   *  commit instead of reading from the live resume record. Use this when saving
   *  branch-specific edits without touching the main resume. */
  consultantTitle: z.string().nullable().optional(),
  presentation: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
  highlightedItems: z.array(z.string()).optional(),
  skillGroups: z.array(resumeCommitSkillGroupSchema).optional(),
  skills: z.array(resumeCommitSkillSchema).optional(),
  assignments: z.array(resumeCommitAssignmentSchema).optional(),
});

export const saveResumeVersionOutputSchema = resumeCommitSchema;
export type SaveResumeVersionInput = z.infer<typeof saveResumeVersionInputSchema>;
export type SaveResumeVersionOutput = z.infer<typeof saveResumeVersionOutputSchema>;

// ---------------------------------------------------------------------------
// updateResumeBranchSkills schemas
// ---------------------------------------------------------------------------

export const updateResumeBranchSkillsInputSchema = z.object({
  branchId: z.string().uuid(),
  skillGroups: z.array(resumeCommitSkillGroupSchema),
  skills: z.array(resumeCommitSkillSchema),
});

export const updateResumeBranchSkillsOutputSchema = z.object({
  branchId: z.string().uuid(),
  skillGroups: z.array(resumeCommitSkillGroupSchema),
  skills: z.array(resumeCommitSkillSchema),
});
export type UpdateResumeBranchSkillsInput = z.infer<typeof updateResumeBranchSkillsInputSchema>;
export type UpdateResumeBranchSkillsOutput = z.infer<typeof updateResumeBranchSkillsOutputSchema>;

// ---------------------------------------------------------------------------
// updateResumeBranchContent schemas
// ---------------------------------------------------------------------------

export const updateResumeBranchContentInputSchema = z.object({
  branchId: z.string().uuid(),
  title: z.string().optional(),
  consultantTitle: z.string().nullable().optional(),
  presentation: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
  highlightedItems: z.array(z.string()).optional(),
  education: z.array(resumeCommitEducationSchema).optional(),
}).refine(
  (input) =>
    input.title !== undefined
    || input.education !== undefined
    || input.consultantTitle !== undefined
    || input.presentation !== undefined
    || input.summary !== undefined
    || input.highlightedItems !== undefined,
  {
    message: "At least one branch content field must be provided",
  },
);

export const updateResumeBranchContentOutputSchema = z.object({
  branchId: z.string().uuid(),
  title: z.string(),
  consultantTitle: z.string().nullable(),
  presentation: z.array(z.string()),
  summary: z.string().nullable(),
  highlightedItems: z.array(z.string()),
  education: z.array(resumeCommitEducationSchema),
});
export type UpdateResumeBranchContentInput = z.infer<typeof updateResumeBranchContentInputSchema>;
export type UpdateResumeBranchContentOutput = z.infer<typeof updateResumeBranchContentOutputSchema>;

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

export const resumeCommitListItemSchema = resumeCommitSummarySchema;

export type ResumeCommitListItem = z.infer<typeof resumeCommitListItemSchema>;

export const listResumeCommitsInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const listResumeCommitsOutputSchema = z.array(resumeCommitListItemSchema);

// ---------------------------------------------------------------------------
// forkResumeBranch schemas
//
// Creates a new branch forked from a specific commit. The new branch starts
// from that commit's snapshot through `forkedFromCommitId`.
// ---------------------------------------------------------------------------

export const forkResumeBranchInputSchema = z.object({
  fromCommitId: z.string().uuid(),
  name: z.string().min(1),
});

export const forkResumeBranchOutputSchema = resumeBranchSchema;

// ---------------------------------------------------------------------------
// finaliseResumeBranch schemas
// ---------------------------------------------------------------------------

export const finaliseResumeBranchInputSchema = z.object({
  sourceBranchId: z.string().uuid(),
  revisionBranchId: z.string().uuid(),
  action: z.enum(["merge", "keep"]),
});

export const finaliseResumeBranchOutputSchema = z.object({
  resultBranchId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// deleteResumeBranch schemas
// ---------------------------------------------------------------------------

export const deleteResumeBranchInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const deleteResumeBranchOutputSchema = z.object({
  deleted: z.boolean(),
});

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

export const resumeCommitGraphNodeSchema = resumeCommitListItemSchema;

export type ResumeCommitGraphNode = z.infer<typeof resumeCommitGraphNodeSchema>;

export const resumeBranchHistoryGraphSchema = z.object({
  branches: z.array(resumeBranchSchema),
  commits: z.array(resumeCommitGraphNodeSchema),
  edges: z.array(resumeCommitGraphEdgeSchema),
});

export const getResumeBranchHistoryGraphOutputSchema = resumeBranchHistoryGraphSchema;

export type ResumeBranchHistoryGraph = z.infer<typeof resumeBranchHistoryGraphSchema>;

// ---------------------------------------------------------------------------
// createTranslationBranch schemas
//
// Creates a translation branch (child of a variant) for a target language.
// ---------------------------------------------------------------------------

export const createTranslationBranchInputSchema = z.object({
  sourceBranchId: z.string().uuid(),
  language: z.string().min(2),
  name: z.string().min(1).optional(),
});

export const createTranslationBranchOutputSchema = resumeBranchSchema;

export type CreateTranslationBranchInput = z.infer<typeof createTranslationBranchInputSchema>;
export type CreateTranslationBranchOutput = z.infer<typeof createTranslationBranchOutputSchema>;

// ---------------------------------------------------------------------------
// createRevisionBranch schemas
//
// Creates a short-lived working branch off a variant.
// ---------------------------------------------------------------------------

export const createRevisionBranchInputSchema = z.object({
  sourceBranchId: z.string().uuid(),
  name: z.string().min(1),
});

export const createRevisionBranchOutputSchema = resumeBranchSchema;

export type CreateRevisionBranchInput = z.infer<typeof createRevisionBranchInputSchema>;
export type CreateRevisionBranchOutput = z.infer<typeof createRevisionBranchOutputSchema>;

// ---------------------------------------------------------------------------
// mergeRevisionIntoSource schemas
//
// Fast-forwards the source variant's HEAD to the revision's HEAD, then
// deletes the revision branch. Fails if source has advanced past the
// revision's fork point (user must rebase first).
// ---------------------------------------------------------------------------

export const mergeRevisionIntoSourceInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const mergeRevisionIntoSourceOutputSchema = z.object({
  mergedIntoBranchId: z.string().uuid(),
});

export type MergeRevisionIntoSourceInput = z.infer<typeof mergeRevisionIntoSourceInputSchema>;
export type MergeRevisionIntoSourceOutput = z.infer<typeof mergeRevisionIntoSourceOutputSchema>;

// ---------------------------------------------------------------------------
// promoteRevisionToVariant schemas
//
// Converts a revision branch into a standalone variant: clears
// branch_type → 'variant', source_branch_id → NULL, source_commit_id → NULL.
// ---------------------------------------------------------------------------

export const promoteRevisionToVariantInputSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
});

export const promoteRevisionToVariantOutputSchema = resumeBranchSchema;

export type PromoteRevisionToVariantInput = z.infer<typeof promoteRevisionToVariantInputSchema>;
export type PromoteRevisionToVariantOutput = z.infer<typeof promoteRevisionToVariantOutputSchema>;

// ---------------------------------------------------------------------------
// markTranslationCaughtUp schemas
//
// Updates source_commit_id to the source variant's current HEAD, signalling
// the translation is considered up-to-date with the source.
// ---------------------------------------------------------------------------

export const markTranslationCaughtUpInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const markTranslationCaughtUpOutputSchema = resumeBranchSchema;

export type MarkTranslationCaughtUpInput = z.infer<typeof markTranslationCaughtUpInputSchema>;
export type MarkTranslationCaughtUpOutput = z.infer<typeof markTranslationCaughtUpOutputSchema>;

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
  highlightedItems: fieldChange(z.array(z.string())).optional(),
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

// ---------------------------------------------------------------------------
// archiveResumeBranch schemas
//
// Soft-archives (or unarchives) a branch. Archived branches are hidden by
// default in the compare picker and branch list.
// ---------------------------------------------------------------------------

export const archiveResumeBranchInputSchema = z.object({
  branchId: z.string().uuid(),
  isArchived: z.boolean(),
});

export const archiveResumeBranchOutputSchema = resumeBranchSchema;

export type ArchiveResumeBranchInput = z.infer<typeof archiveResumeBranchInputSchema>;
export type ArchiveResumeBranchOutput = z.infer<typeof archiveResumeBranchOutputSchema>;

// ---------------------------------------------------------------------------
// revertCommit schemas
//
// Creates a new commit on the branch with the content of an older commit,
// effectively restoring the CV to that earlier snapshot without destroying
// history. The target commit must be reachable from the branch's HEAD.
// ---------------------------------------------------------------------------

export const revertCommitInputSchema = z.object({
  branchId: z.string().uuid(),
  targetCommitId: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const revertCommitOutputSchema = resumeCommitSchema;

export type RevertCommitInput = z.infer<typeof revertCommitInputSchema>;
export type RevertCommitOutput = z.infer<typeof revertCommitOutputSchema>;

// ---------------------------------------------------------------------------
// rebaseTranslationOntoSource schemas
//
// "Ful rebase" for translation branches: takes the source variant's current
// HEAD content, creates a new commit on the translation branch with that
// content, and advances source_commit_id. The translator must then re-translate
// the changed sections. Destructive — overwrites translation content with
// untranslated source content.
// ---------------------------------------------------------------------------

export const rebaseTranslationOntoSourceInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const rebaseTranslationOntoSourceOutputSchema = resumeBranchSchema;

export type RebaseTranslationOntoSourceInput = z.infer<typeof rebaseTranslationOntoSourceInputSchema>;
export type RebaseTranslationOntoSourceOutput = z.infer<typeof rebaseTranslationOntoSourceOutputSchema>;

// ---------------------------------------------------------------------------
// rebaseRevisionOntoSource schemas
//
// When a source variant has advanced past a revision's fork point (blocking
// merge), this operation creates a new commit on the revision that carries
// the revision's changes forward — with the new source HEAD as its parent.
// Updates source_commit_id so merge is unblocked.
// ---------------------------------------------------------------------------

export const rebaseRevisionOntoSourceInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const rebaseRevisionOntoSourceOutputSchema = resumeBranchSchema;

export type RebaseRevisionOntoSourceInput = z.infer<typeof rebaseRevisionOntoSourceInputSchema>;
export type RebaseRevisionOntoSourceOutput = z.infer<typeof rebaseRevisionOntoSourceOutputSchema>;
