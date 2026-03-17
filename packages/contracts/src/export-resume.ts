import { z } from "zod";

export const exportResumeMarkdownInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const exportResumeMarkdownOutputSchema = z.object({
  markdown: z.string(),
  filename: z.string(),
  referenceId: z.string().uuid(),
});

export const exportResumePdfInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const exportResumePdfOutputSchema = z.object({
  /** Base64-encoded PDF bytes */
  pdf: z.string(),
  filename: z.string(),
  referenceId: z.string().uuid(),
});

export const exportResumeDocxInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const exportResumeDocxOutputSchema = z.object({
  /** Base64-encoded DOCX bytes */
  docx: z.string(),
  filename: z.string(),
  referenceId: z.string().uuid(),
});
