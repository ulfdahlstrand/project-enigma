import { oc } from "@orpc/contract";
import {
  listBranchAssignmentsInputSchema,
  listBranchAssignmentsOutputSchema,
  addBranchAssignmentInputSchema,
  addBranchAssignmentOutputSchema,
  removeBranchAssignmentInputSchema,
  removeBranchAssignmentOutputSchema,
  updateBranchAssignmentInputSchema,
  updateBranchAssignmentOutputSchema,
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "../../branch-assignments.js";

export const branchAssignmentRoutes = {
  listBranchAssignments: oc
    .route({ method: "GET", path: "/resume-branches/{branchId}/assignment-links" })
    .input(listBranchAssignmentsInputSchema)
    .output(listBranchAssignmentsOutputSchema),
  addBranchAssignment: oc
    .route({ method: "POST", path: "/resume-branches/{branchId}/assignments" })
    .input(addBranchAssignmentInputSchema)
    .output(addBranchAssignmentOutputSchema),
  removeBranchAssignment: oc
    .route({ method: "DELETE", path: "/branch-assignments/{id}" })
    .input(removeBranchAssignmentInputSchema)
    .output(removeBranchAssignmentOutputSchema),
  updateBranchAssignment: oc
    .route({ method: "PATCH", path: "/branch-assignments/{id}" })
    .input(updateBranchAssignmentInputSchema)
    .output(updateBranchAssignmentOutputSchema),
  listBranchAssignmentsFull: oc
    .route({ method: "GET", path: "/resume-branches/{branchId}/assignments" })
    .input(listBranchAssignmentsFullInputSchema)
    .output(listBranchAssignmentsFullOutputSchema),
};
