import { z } from "zod";

export const exportResumeMarkdownInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const exportResumeMarkdownOutputSchema = z.object({
  markdown: z.string(),
  filename: z.string(),
  referenceId: z.string().uuid(),
});
