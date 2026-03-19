import { z } from "zod";

// ---------------------------------------------------------------------------
// CV JSON import schemas — v3 format
// ---------------------------------------------------------------------------

const cvAssignmentSchema = z.object({
  client: z.string(),
  role: z.string(),
  period: z.string().optional().default(""),
  context: z.string().optional().default(""),
  responsibilities: z.string().optional().default(""),
  result: z.string().optional().default(""),
  technologies: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  type: z.string().optional(),
  highlight: z.boolean().optional(),
});

const cvEducationSchema = z.object({
  degrees: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

const cvConsultantSchema = z.object({
  name: z.string(),
  title: z.string().default(""),
  presentation: z.array(z.string()).default([]),
}).catchall(z.unknown());

export const cvJsonSchema = z.object({
  _meta: z.record(z.string(), z.unknown()).optional(),
  consultant: cvConsultantSchema,
  skills: z.record(z.string(), z.unknown()).optional(),
  education: cvEducationSchema,
  assignments: z.array(cvAssignmentSchema),
});

export type CvJson = z.infer<typeof cvJsonSchema>;

// ---------------------------------------------------------------------------
// importCv input / output
// ---------------------------------------------------------------------------

export const importCvInputSchema = z.object({
  employeeId: z.string().uuid(),
  language: z.string().default("en"),
  cvJson: cvJsonSchema,
});

export const importCvOutputSchema = z.object({
  resumeCreated: z.boolean(),
  assignmentsCreated: z.number(),
  assignmentsSkipped: z.number(),
  educationCreated: z.number(),
  educationSkipped: z.number(),
});

// ---------------------------------------------------------------------------
// parseCvDocx input / output
// ---------------------------------------------------------------------------

export const parseCvDocxInputSchema = z.object({
  docxBase64: z.string(),
  language: z.string().default("en"),
});

export const parseCvDocxOutputSchema = z.object({
  cvJson: cvJsonSchema,
});
