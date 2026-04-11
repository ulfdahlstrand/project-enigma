import { z } from "zod";
import { branchAssignmentSchema } from "./resume-versions.js";

// ---------------------------------------------------------------------------
// BranchAssignment schemas
//
// Per-branch assignment content CRUD backed by the branch's current commit
// content. Editing remains branch-isolated without a dedicated table.
// ---------------------------------------------------------------------------

export const branchAssignmentItemSchema = branchAssignmentSchema;
export type BranchAssignmentItem = z.infer<typeof branchAssignmentItemSchema>;

// ---------------------------------------------------------------------------
// Full branch assignment — includes all content fields
// ---------------------------------------------------------------------------

export const fullBranchAssignmentSchema = z.object({
  id: z.string().uuid(),           // assignment identity id (used for updates/removes)
  assignmentId: z.string().uuid(),
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

export type FullBranchAssignment = z.infer<typeof fullBranchAssignmentSchema>;

// ---------------------------------------------------------------------------
// listBranchAssignments (thin — link rows only)
// ---------------------------------------------------------------------------

export const listBranchAssignmentsInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const listBranchAssignmentsOutputSchema = z.array(branchAssignmentItemSchema);

// ---------------------------------------------------------------------------
// listBranchAssignmentsFull — returns full content per branch
// ---------------------------------------------------------------------------

export const listBranchAssignmentsFullInputSchema = z.object({
  branchId: z.string().uuid(),
});

export const listBranchAssignmentsFullOutputSchema = z.array(fullBranchAssignmentSchema);

// ---------------------------------------------------------------------------
// addBranchAssignment — link assignment identity to a branch with content
// ---------------------------------------------------------------------------

export const addBranchAssignmentInputSchema = z.object({
  branchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  clientName: z.string().min(1),
  role: z.string().min(1),
  description: z.string().default(""),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  technologies: z.array(z.string()).default([]),
  isCurrent: z.boolean().default(false),
  keywords: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  highlight: z.boolean().optional(),
  sortOrder: z.number().nullable().optional(),
});

export const addBranchAssignmentOutputSchema = fullBranchAssignmentSchema;

export const addResumeBranchAssignmentInputSchema = addBranchAssignmentInputSchema.extend({
  resumeId: z.string().uuid(),
});
export type AddResumeBranchAssignmentInput = z.infer<typeof addResumeBranchAssignmentInputSchema>;

// ---------------------------------------------------------------------------
// removeBranchAssignment
// ---------------------------------------------------------------------------

export const removeBranchAssignmentInputSchema = z.object({
  branchId: z.string().uuid(),
  id: z.string().uuid(),
});

export const removeBranchAssignmentOutputSchema = z.object({
  deleted: z.literal(true),
});

export const removeResumeBranchAssignmentInputSchema = removeBranchAssignmentInputSchema.extend({
  resumeId: z.string().uuid(),
});
export type RemoveResumeBranchAssignmentInput = z.infer<typeof removeResumeBranchAssignmentInputSchema>;

// ---------------------------------------------------------------------------
// updateBranchAssignment — content + curation fields, all optional
// ---------------------------------------------------------------------------

export const updateBranchAssignmentInputSchema = z
  .object({
    branchId: z.string().uuid(),
    id: z.string().uuid(),
    // Content fields
    clientName: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    technologies: z.array(z.string()).optional(),
    isCurrent: z.boolean().optional(),
    keywords: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    // Curation fields
    highlight: z.boolean().optional(),
    sortOrder: z.number().nullable().optional(),
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
      d.keywords !== undefined ||
      d.type !== undefined ||
      d.highlight !== undefined ||
      d.sortOrder !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateBranchAssignmentOutputSchema = fullBranchAssignmentSchema;

export const updateResumeBranchAssignmentInputSchema = updateBranchAssignmentInputSchema.extend({
  resumeId: z.string().uuid(),
});
export type UpdateResumeBranchAssignmentInput = z.infer<typeof updateResumeBranchAssignmentInputSchema>;
