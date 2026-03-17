import { z } from "zod";

// ---------------------------------------------------------------------------
// CV JSON import schemas
//
// These schemas describe the shape of the JSON file produced by the CV
// extraction tooling (Codex). The `importCv` procedure accepts a parsed
// CV JSON payload and an existing employee ID, then upserts/creates the
// relevant records (assignments, education) in the database.
// ---------------------------------------------------------------------------

const cvAssignmentSchema = z.object({
  role: z.string(),
  customer: z.string(),
  period: z.string(),
  description_raw: z.array(z.string()),
  tekniker: z.string(),
  nyckelord: z.string(),
});

const cvEducationSchema = z.object({
  degrees: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

const cvConsultantSchema = z.object({
  name: z.string(),
  title: z.string(),
  presentation: z.array(z.string()),
});

export const cvJsonSchema = z.object({
  consultant: cvConsultantSchema,
  education: cvEducationSchema,
  assignments: z.array(cvAssignmentSchema),
});

export type CvJson = z.infer<typeof cvJsonSchema>;

// ---------------------------------------------------------------------------
// importCv input / output
// ---------------------------------------------------------------------------

export const importCvInputSchema = z.object({
  employeeId: z.string().uuid(),
  cvJson: cvJsonSchema,
});

export const importCvOutputSchema = z.object({
  assignmentsCreated: z.number(),
  assignmentsSkipped: z.number(),
  educationCreated: z.number(),
  educationSkipped: z.number(),
});
