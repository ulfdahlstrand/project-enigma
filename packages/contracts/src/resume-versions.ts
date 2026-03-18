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
