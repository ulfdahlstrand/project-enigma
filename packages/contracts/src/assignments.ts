import { z } from "zod";

// ---------------------------------------------------------------------------
// Assignment schemas
//
// After the branch-content migration, `assignments` is an identity-only table.
// All mutable content lives in `branch_assignments`.
// ---------------------------------------------------------------------------

/** Identity-only record — no content fields. */
export const assignmentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  createdAt: z.union([z.string(), z.date()]),
});

export type Assignment = z.infer<typeof assignmentSchema>;

// ---------------------------------------------------------------------------
// createAssignment — branchId is required; content goes into branch_assignments
// ---------------------------------------------------------------------------

export const createAssignmentInputSchema = z.object({
  employeeId: z.string().uuid(),
  branchId: z.string().uuid(),
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

// createAssignment returns the full branch-assignment content (not identity-only)
// so the caller has everything needed to update the UI.
export const createAssignmentOutputSchema = z.object({
  id: z.string().uuid(),           // branch_assignment id
  assignmentId: z.string().uuid(), // assignment identity id
  branchId: z.string().uuid(),
  employeeId: z.string().uuid(),
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
  sortOrder: z.number().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// ---------------------------------------------------------------------------
// deleteAssignment — deletes the identity record (cascades to all branches)
// ---------------------------------------------------------------------------

export const deleteAssignmentInputSchema = z.object({ id: z.string().uuid() });
export const deleteAssignmentOutputSchema = z.object({ deleted: z.literal(true) });
