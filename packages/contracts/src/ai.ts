import { z } from "zod";

// ---------------------------------------------------------------------------
// AI procedure schemas
// ---------------------------------------------------------------------------

export const improveDescriptionInputSchema = z.object({
  description: z.string().min(1).max(5000),
  role: z.string().optional(),
  clientName: z.string().optional(),
});

export const improveDescriptionOutputSchema = z.object({
  improvedDescription: z.string(),
});

export type ImproveDescriptionInput = z.infer<typeof improveDescriptionInputSchema>;
export type ImproveDescriptionOutput = z.infer<typeof improveDescriptionOutputSchema>;
