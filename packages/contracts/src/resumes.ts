import { z } from "zod";

// ---------------------------------------------------------------------------
// Resume schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
//
// `createdAt` / `updatedAt` accept both `string` (ISO-8601 serialised) and
// `Date` objects so the schemas remain compatible whether the backend returns
// plain-JS Date instances from Kysely or serialised strings from JSON.
// ---------------------------------------------------------------------------

export const resumeSkillGroupSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number(),
});

export const resumeSkillSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

export const resumeSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  consultantTitle: z.string().nullable(),
  presentation: z.array(z.string()),
  summary: z.string().nullable(),
  highlightedItems: z.array(z.string()).default([]),
  language: z.string(),
  isMain: z.boolean(),
  /** ID of the main branch for this resume. Omitted when branch data is not fetched. */
  mainBranchId: z.string().uuid().nullable().optional(),
  /** HEAD commit ID of the main branch. Omitted when branch data is not fetched. */
  headCommitId: z.string().uuid().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const resumeWithSkillsSchema = resumeSchema.extend({
  skillGroups: z.array(resumeSkillGroupSchema),
  skills: z.array(resumeSkillSchema),
});

// ---------------------------------------------------------------------------
// listResumes schemas
// ---------------------------------------------------------------------------

export const listResumesInputSchema = z.object({
  employeeId: z.string().uuid().optional(),
  language: z.string().optional(),
});

export const listResumesOutputSchema = z.array(resumeSchema);

// ---------------------------------------------------------------------------
// getResume schemas
// ---------------------------------------------------------------------------

export const getResumeInputSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid().optional(),
});
export const getResumeOutputSchema = resumeWithSkillsSchema;

// ---------------------------------------------------------------------------
// createResume schemas
// ---------------------------------------------------------------------------

export const createResumeInputSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(1),
  language: z.string().default("en"),
  summary: z.string().nullable().optional(),
});

export const createResumeOutputSchema = resumeWithSkillsSchema;

// ---------------------------------------------------------------------------
// updateResume schemas
// ---------------------------------------------------------------------------

export const updateResumeInputSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    consultantTitle: z.string().nullable().optional(),
    presentation: z.array(z.string()).optional(),
    summary: z.string().nullable().optional(),
    highlightedItems: z.array(z.string()).optional(),
    language: z.string().optional(),
    isMain: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.consultantTitle !== undefined ||
      d.presentation !== undefined ||
      d.summary !== undefined ||
      d.highlightedItems !== undefined ||
      d.language !== undefined ||
      d.isMain !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateResumeOutputSchema = resumeSchema;

// ---------------------------------------------------------------------------
// deleteResume schemas
// ---------------------------------------------------------------------------

export const deleteResumeInputSchema = z.object({ id: z.string().uuid() });
export const deleteResumeOutputSchema = z.object({ deleted: z.literal(true) });

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// createResumeSkillGroup schemas
// ---------------------------------------------------------------------------

export const createResumeSkillGroupInputSchema = z.object({
  resumeId: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export const createResumeSkillGroupOutputSchema = resumeSkillGroupSchema;

// ---------------------------------------------------------------------------
// updateResumeSkillGroup schemas
// ---------------------------------------------------------------------------

export const updateResumeSkillGroupInputSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.sortOrder !== undefined,
    { message: "At least one field must be provided" },
  );

export const updateResumeSkillGroupOutputSchema = resumeSkillGroupSchema;

// ---------------------------------------------------------------------------
// createResumeSkill schemas
// ---------------------------------------------------------------------------

export const createResumeSkillInputSchema = z.object({
  resumeId: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export const createResumeSkillOutputSchema = resumeSkillSchema;

// ---------------------------------------------------------------------------
// updateResumeSkill schemas
// ---------------------------------------------------------------------------

export const updateResumeSkillInputSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    groupId: z.string().uuid().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.groupId !== undefined ||
      d.sortOrder !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateResumeSkillOutputSchema = resumeSkillSchema;

// ---------------------------------------------------------------------------
// deleteResumeSkill schemas
// ---------------------------------------------------------------------------

export const deleteResumeSkillInputSchema = z.object({ id: z.string().uuid() });
export const deleteResumeSkillOutputSchema = z.object({ deleted: z.literal(true) });

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type ResumeSkill = z.infer<typeof resumeSkillSchema>;
export type ResumeSkillGroup = z.infer<typeof resumeSkillGroupSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type ResumeWithSkills = z.infer<typeof resumeWithSkillsSchema>;
