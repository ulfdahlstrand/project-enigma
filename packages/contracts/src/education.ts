import { z } from "zod";

// ---------------------------------------------------------------------------
// Education schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
// ---------------------------------------------------------------------------

export const educationTypeSchema = z.enum(["degree", "certification", "language"]);
export type EducationType = z.infer<typeof educationTypeSchema>;

export const educationSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  type: educationTypeSchema,
  value: z.string(),
  sortOrder: z.number(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type Education = z.infer<typeof educationSchema>;

// ---------------------------------------------------------------------------
// listEducation
// ---------------------------------------------------------------------------

export const listEducationInputSchema = z.object({
  employeeId: z.string().uuid(),
});

export const listEducationOutputSchema = z.array(educationSchema);

// ---------------------------------------------------------------------------
// createEducation
// ---------------------------------------------------------------------------

export const createEducationInputSchema = z.object({
  employeeId: z.string().uuid(),
  type: educationTypeSchema,
  value: z.string().min(1).max(500),
  sortOrder: z.number().int().default(0),
});

export const createEducationOutputSchema = educationSchema;

// ---------------------------------------------------------------------------
// deleteEducation
// ---------------------------------------------------------------------------

export const deleteEducationInputSchema = z.object({ id: z.string().uuid() });
export const deleteEducationOutputSchema = z.object({ deleted: z.literal(true) });
