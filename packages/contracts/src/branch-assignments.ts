import { z } from "zod";
import { branchAssignmentSchema } from "./resume-versions.js";

// ---------------------------------------------------------------------------
// BranchAssignment schemas
//
// Per-branch assignment linking CRUD.
// Each resume branch maintains its own curated list of assignments
// independently of other branches on the same resume.
//
// The item schema re-uses branchAssignmentSchema from resume-versions to
// keep a single source of truth for the row shape.
// ---------------------------------------------------------------------------

export const branchAssignmentItemSchema = branchAssignmentSchema;

export type BranchAssignmentItem = z.infer<typeof branchAssignmentItemSchema>;

// ---------------------------------------------------------------------------
// listBranchAssignments schemas
// ---------------------------------------------------------------------------

export const listBranchAssignmentsInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const listBranchAssignmentsOutputSchema = z.array(branchAssignmentItemSchema);

// ---------------------------------------------------------------------------
// addBranchAssignment schemas
// ---------------------------------------------------------------------------

export const addBranchAssignmentInputSchema = z.object({
  branchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  highlight: z.boolean().optional(),
  sortOrder: z.number().nullable().optional(),
});

export const addBranchAssignmentOutputSchema = branchAssignmentItemSchema;

// ---------------------------------------------------------------------------
// removeBranchAssignment schemas
// ---------------------------------------------------------------------------

export const removeBranchAssignmentInputSchema = z.object({
  id: z.string().uuid(),
});

export const removeBranchAssignmentOutputSchema = z.object({
  deleted: z.literal(true),
});

// ---------------------------------------------------------------------------
// updateBranchAssignment schemas
// ---------------------------------------------------------------------------

export const updateBranchAssignmentInputSchema = z
  .object({
    id: z.string().uuid(),
    highlight: z.boolean().optional(),
    sortOrder: z.number().nullable().optional(),
  })
  .refine(
    (d) => d.highlight !== undefined || d.sortOrder !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateBranchAssignmentOutputSchema = branchAssignmentItemSchema;

// ---------------------------------------------------------------------------
// listBranchAssignmentsFull schemas
//
// Returns full assignment data joined from the assignments table, augmented
// with highlight and sortOrder from the branch_assignments join row.
// Use this instead of listAssignments({ resumeId }) to load assignments for
// any branch (main or non-main) from the unified branch_assignments source.
// ---------------------------------------------------------------------------

export const listBranchAssignmentsFullInputSchema = z.object({
  branchId: z.string().uuid(),
});

const fullAssignmentSchema = z.object({
  id: z.string().uuid(),
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

export type FullBranchAssignment = z.infer<typeof fullAssignmentSchema>;

export const listBranchAssignmentsFullOutputSchema = z.array(fullAssignmentSchema);
