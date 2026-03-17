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

export const resumeSkillSchema = z.object({
  id: z.string().uuid(),
  cvId: z.string().uuid(),
  name: z.string(),
  level: z.string().nullable(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

export const resumeSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  language: z.string(),
  isMain: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const resumeWithSkillsSchema = resumeSchema.extend({
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

export const getResumeInputSchema = z.object({ id: z.string().uuid() });
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
    summary: z.string().nullable().optional(),
    language: z.string().optional(),
    isMain: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.summary !== undefined ||
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
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type ResumeSkill = z.infer<typeof resumeSkillSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type ResumeWithSkills = z.infer<typeof resumeWithSkillsSchema>;
