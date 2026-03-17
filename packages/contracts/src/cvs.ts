import { z } from "zod";

// ---------------------------------------------------------------------------
// CV schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
//
// `createdAt` / `updatedAt` accept both `string` (ISO-8601 serialised) and
// `Date` objects so the schemas remain compatible whether the backend returns
// plain-JS Date instances from Kysely or serialised strings from JSON.
// ---------------------------------------------------------------------------

export const cvSkillSchema = z.object({
  id: z.string().uuid(),
  cvId: z.string().uuid(),
  name: z.string(),
  level: z.string().nullable(),
  category: z.string().nullable(),
  sortOrder: z.number(),
});

export const cvSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  language: z.string(),
  isMain: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const cvWithSkillsSchema = cvSchema.extend({
  skills: z.array(cvSkillSchema),
});

// ---------------------------------------------------------------------------
// listCVs schemas
// ---------------------------------------------------------------------------

export const listCVsInputSchema = z.object({
  employeeId: z.string().uuid().optional(),
  language: z.string().optional(),
});

export const listCVsOutputSchema = z.array(cvSchema);

// ---------------------------------------------------------------------------
// getCV schemas
// ---------------------------------------------------------------------------

export const getCVInputSchema = z.object({ id: z.string().uuid() });
export const getCVOutputSchema = cvWithSkillsSchema;

// ---------------------------------------------------------------------------
// createCV schemas
// ---------------------------------------------------------------------------

export const createCVInputSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(1),
  language: z.string().default("en"),
  summary: z.string().nullable().optional(),
});

export const createCVOutputSchema = cvWithSkillsSchema;

// ---------------------------------------------------------------------------
// updateCV schemas
// ---------------------------------------------------------------------------

export const updateCVInputSchema = z
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

export const updateCVOutputSchema = cvSchema;

// ---------------------------------------------------------------------------
// deleteCV schemas
// ---------------------------------------------------------------------------

export const deleteCVInputSchema = z.object({ id: z.string().uuid() });
export const deleteCVOutputSchema = z.object({ deleted: z.literal(true) });

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type CVSkill = z.infer<typeof cvSkillSchema>;
export type CV = z.infer<typeof cvSchema>;
export type CVWithSkills = z.infer<typeof cvWithSkillsSchema>;
