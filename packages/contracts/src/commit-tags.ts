import { z } from "zod";

// ---------------------------------------------------------------------------
// CommitTag schemas
//
// Cross-resume translation link: pins two commits (source, target) across
// different-language resumes as corresponding to each other.
// ---------------------------------------------------------------------------

export const commitTagSchema = z.object({
  id: z.string().uuid(),
  sourceCommitId: z.string().uuid(),
  targetCommitId: z.string().uuid(),
  kind: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  createdBy: z.string().uuid().nullable(),
});

export const linkedResumeMetaSchema = z.object({
  resumeId: z.string().uuid(),
  resumeTitle: z.string(),
  language: z.string(),
  commitId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  branchName: z.string().nullable(),
});

/** CommitTag with linked-resume metadata on both sides, for UI rendering. */
export const commitTagWithLinkedResumeSchema = commitTagSchema.extend({
  source: linkedResumeMetaSchema,
  target: linkedResumeMetaSchema,
});

// ---------------------------------------------------------------------------
// listCommitTags
// ---------------------------------------------------------------------------

export const listCommitTagsInputSchema = z.object({
  resumeId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});

export const listCommitTagsOutputSchema = z.array(commitTagWithLinkedResumeSchema);

// ---------------------------------------------------------------------------
// createCommitTag
// ---------------------------------------------------------------------------

export const createCommitTagInputSchema = z.object({
  sourceCommitId: z.string().uuid(),
  targetCommitId: z.string().uuid(),
  kind: z.string().default("translation"),
});

export const createCommitTagOutputSchema = commitTagSchema;

// ---------------------------------------------------------------------------
// deleteCommitTag
// ---------------------------------------------------------------------------

export const deleteCommitTagInputSchema = z.object({
  id: z.string().uuid(),
});

export const deleteCommitTagOutputSchema = z.object({
  success: z.boolean(),
});

// ---------------------------------------------------------------------------
// getTranslationStatus
// ---------------------------------------------------------------------------

export const getTranslationStatusInputSchema = z.object({
  resumeId: z.string().uuid(),
  targetResumeId: z.string().uuid(),
});

export const getTranslationStatusOutputSchema = z.object({
  latestTag: commitTagSchema.nullable(),
  isStale: z.boolean(),
  sourceHeadCommitId: z.string().uuid().nullable(),
  targetHeadCommitId: z.string().uuid().nullable(),
});

// ---------------------------------------------------------------------------
// Derived TypeScript types
// ---------------------------------------------------------------------------
// createTranslationResume
// ---------------------------------------------------------------------------

export const createTranslationResumeInputSchema = z.object({
  sourceResumeId: z.string().uuid(),
  targetLanguage: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const createTranslationResumeOutputSchema = z.object({
  resumeId: z.string().uuid(),
  commitTagId: z.string().uuid(),
});

// ---------------------------------------------------------------------------

export type CommitTag = z.infer<typeof commitTagSchema>;
export type LinkedResumeMeta = z.infer<typeof linkedResumeMetaSchema>;
export type CommitTagWithLinkedResume = z.infer<typeof commitTagWithLinkedResumeSchema>;
export type ListCommitTagsInput = z.infer<typeof listCommitTagsInputSchema>;
export type ListCommitTagsOutput = z.infer<typeof listCommitTagsOutputSchema>;
export type CreateCommitTagInput = z.infer<typeof createCommitTagInputSchema>;
export type CreateCommitTagOutput = z.infer<typeof createCommitTagOutputSchema>;
export type DeleteCommitTagInput = z.infer<typeof deleteCommitTagInputSchema>;
export type DeleteCommitTagOutput = z.infer<typeof deleteCommitTagOutputSchema>;
export type GetTranslationStatusInput = z.infer<typeof getTranslationStatusInputSchema>;
export type GetTranslationStatusOutput = z.infer<typeof getTranslationStatusOutputSchema>;
export type CreateTranslationResumeInput = z.infer<typeof createTranslationResumeInputSchema>;
export type CreateTranslationResumeOutput = z.infer<typeof createTranslationResumeOutputSchema>;
