import { z } from "zod";

// ---------------------------------------------------------------------------
// Assignment schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
// ---------------------------------------------------------------------------

export const assignmentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  resumeId: z.string().uuid().nullable(),
  clientName: z.string(),
  role: z.string(),
  description: z.string(),
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).nullable(),
  technologies: z.array(z.string()),
  isCurrent: z.boolean(),
  keywords: z.string().nullable(),
  type: z.string().nullable(),
  highlight: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type Assignment = z.infer<typeof assignmentSchema>;

// ---------------------------------------------------------------------------
// listAssignments
// ---------------------------------------------------------------------------

export const listAssignmentsInputSchema = z.object({
  employeeId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
});

export const listAssignmentsOutputSchema = z.array(assignmentSchema);

// ---------------------------------------------------------------------------
// getAssignment
// ---------------------------------------------------------------------------

export const getAssignmentInputSchema = z.object({ id: z.string().uuid() });
export const getAssignmentOutputSchema = assignmentSchema;

// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

export const createAssignmentInputSchema = z.object({
  employeeId: z.string().uuid(),
  resumeId: z.string().uuid().nullable().optional(),
  clientName: z.string().min(1),
  role: z.string().min(1),
  description: z.string().default(""),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  technologies: z.array(z.string()).default([]),
  isCurrent: z.boolean().default(false),
  keywords: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  highlight: z.boolean().default(false),
});

export const createAssignmentOutputSchema = assignmentSchema;

// ---------------------------------------------------------------------------
// updateAssignment
// ---------------------------------------------------------------------------

export const updateAssignmentInputSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid().nullable().optional(),
    clientName: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    technologies: z.array(z.string()).optional(),
    isCurrent: z.boolean().optional(),
    keywords: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    highlight: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.clientName !== undefined ||
      d.role !== undefined ||
      d.description !== undefined ||
      d.startDate !== undefined ||
      d.endDate !== undefined ||
      d.technologies !== undefined ||
      d.isCurrent !== undefined ||
      d.resumeId !== undefined ||
      d.keywords !== undefined ||
      d.type !== undefined ||
      d.highlight !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateAssignmentOutputSchema = assignmentSchema;

// ---------------------------------------------------------------------------
// deleteAssignment
// ---------------------------------------------------------------------------

export const deleteAssignmentInputSchema = z.object({ id: z.string().uuid() });
export const deleteAssignmentOutputSchema = z.object({ deleted: z.literal(true) });
