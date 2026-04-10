import { z } from "zod";

export const aiPromptCategorySchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
});

export const aiPromptFragmentSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  label: z.string().min(1),
  content: z.string(),
  sortOrder: z.number().int(),
});

export const aiPromptDefinitionSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  sourceFile: z.string().min(1),
  isEditable: z.boolean(),
  sortOrder: z.number().int(),
  fragments: z.array(aiPromptFragmentSchema),
});

export const aiPromptCategoryWithPromptsSchema = aiPromptCategorySchema.extend({
  prompts: z.array(aiPromptDefinitionSchema),
});

export const listAIPromptConfigsInputSchema = z.object({});

export const listAIPromptConfigsOutputSchema = z.object({
  categories: z.array(aiPromptCategoryWithPromptsSchema),
});

export const updateAIPromptFragmentInputSchema = z.object({
  fragmentId: z.string().uuid(),
  content: z.string(),
});

export const updateAIPromptFragmentOutputSchema = z.object({
  fragment: aiPromptFragmentSchema,
});

export type AIPromptCategory = z.infer<typeof aiPromptCategorySchema>;
export type AIPromptFragment = z.infer<typeof aiPromptFragmentSchema>;
export type AIPromptDefinition = z.infer<typeof aiPromptDefinitionSchema>;
export type AIPromptCategoryWithPrompts = z.infer<typeof aiPromptCategoryWithPromptsSchema>;
export type ListAIPromptConfigsInput = z.infer<typeof listAIPromptConfigsInputSchema>;
export type ListAIPromptConfigsOutput = z.infer<typeof listAIPromptConfigsOutputSchema>;
export type UpdateAIPromptFragmentInput = z.infer<typeof updateAIPromptFragmentInputSchema>;
export type UpdateAIPromptFragmentOutput = z.infer<typeof updateAIPromptFragmentOutputSchema>;
