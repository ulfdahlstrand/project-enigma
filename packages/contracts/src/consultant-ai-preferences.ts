import { z } from "zod";

export const consultantAIPreferencesSchema = z.object({
  employeeId: z.string().uuid(),
  prompt: z.string().nullable(),
  rules: z.string().nullable(),
  validators: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const getConsultantAIPreferencesInputSchema = z.object({});

export const getConsultantAIPreferencesOutputSchema = z.object({
  preferences: consultantAIPreferencesSchema.nullable(),
});

export const updateConsultantAIPreferencesInputSchema = z.object({
  prompt: z.string().nullable().optional(),
  rules: z.string().nullable().optional(),
  validators: z.string().nullable().optional(),
}).refine(
  (input) =>
    input.prompt !== undefined
    || input.rules !== undefined
    || input.validators !== undefined,
  {
    message: "At least one consultant AI preference field must be provided",
  },
);

export const updateConsultantAIPreferencesOutputSchema = z.object({
  preferences: consultantAIPreferencesSchema,
});

export type ConsultantAIPreferences = z.infer<typeof consultantAIPreferencesSchema>;
export type GetConsultantAIPreferencesInput = z.infer<typeof getConsultantAIPreferencesInputSchema>;
export type GetConsultantAIPreferencesOutput = z.infer<typeof getConsultantAIPreferencesOutputSchema>;
export type UpdateConsultantAIPreferencesInput = z.infer<typeof updateConsultantAIPreferencesInputSchema>;
export type UpdateConsultantAIPreferencesOutput = z.infer<typeof updateConsultantAIPreferencesOutputSchema>;
