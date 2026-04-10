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
// updateEducation
// ---------------------------------------------------------------------------

export const updateEducationInputSchema = z
  .object({
    employeeId: z.string().uuid(),
    id: z.string().uuid(),
    type: educationTypeSchema.optional(),
    value: z.string().min(1).max(500).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (d) => d.type !== undefined || d.value !== undefined || d.sortOrder !== undefined,
    { message: "At least one field must be provided" },
  );

export const updateEducationOutputSchema = educationSchema;

// ---------------------------------------------------------------------------
// deleteEducation
// ---------------------------------------------------------------------------

export const deleteEducationInputSchema = z.object({
  employeeId: z.string().uuid(),
  id: z.string().uuid(),
});
export const deleteEducationOutputSchema = z.object({ deleted: z.literal(true) });
