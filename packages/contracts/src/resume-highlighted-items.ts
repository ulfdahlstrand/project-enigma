import { z } from "zod";

export const resumeHighlightedItemSchema = z.object({
  id: z.string().uuid(),
  resumeId: z.string().uuid(),
  text: z.string(),
  sortOrder: z.number().int(),
});

export type ResumeHighlightedItem = z.infer<typeof resumeHighlightedItemSchema>;

// ---------------------------------------------------------------------------
// listResumeHighlightedItems
// ---------------------------------------------------------------------------

export const listResumeHighlightedItemsInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const listResumeHighlightedItemsOutputSchema = z.object({
  items: z.array(resumeHighlightedItemSchema),
});

export type ListResumeHighlightedItemsInput = z.infer<typeof listResumeHighlightedItemsInputSchema>;
export type ListResumeHighlightedItemsOutput = z.infer<typeof listResumeHighlightedItemsOutputSchema>;

// ---------------------------------------------------------------------------
// setResumeHighlightedItems — replaces the full list atomically
// ---------------------------------------------------------------------------

export const setResumeHighlightedItemsInputSchema = z.object({
  resumeId: z.string().uuid(),
  items: z.array(
    z.object({
      text: z.string().min(1),
      sortOrder: z.number().int().optional(),
    })
  ),
});

export const setResumeHighlightedItemsOutputSchema = z.object({
  items: z.array(resumeHighlightedItemSchema),
});

export type SetResumeHighlightedItemsInput = z.infer<typeof setResumeHighlightedItemsInputSchema>;
export type SetResumeHighlightedItemsOutput = z.infer<typeof setResumeHighlightedItemsOutputSchema>;
