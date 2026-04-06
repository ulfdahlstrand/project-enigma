import { z } from "zod";

export const healthInputSchema = z.object({
  echo: z.string().optional(),
});

export const healthOutputSchema = z.object({
  status: z.literal("ok"),
  echo: z.string().optional(),
});

export const listTestEntriesInputSchema = z.object({});

export const testEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string(),
});

export const listTestEntriesOutputSchema = z.object({
  entries: z.array(testEntrySchema),
});

export type TestEntry = z.infer<typeof testEntrySchema>;
