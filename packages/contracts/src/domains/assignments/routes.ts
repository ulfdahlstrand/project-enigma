import { oc } from "@orpc/contract";
import {
  createAssignmentInputSchema,
  createAssignmentOutputSchema,
  deleteAssignmentInputSchema,
  deleteAssignmentOutputSchema,
} from "../../assignments.js";

export const assignmentRoutes = {
  createAssignment: oc
    .route({ method: "POST", path: "/employees/{employeeId}/assignments" })
    .input(createAssignmentInputSchema)
    .output(createAssignmentOutputSchema),
  deleteAssignment: oc
    .route({ method: "DELETE", path: "/assignments/{id}" })
    .input(deleteAssignmentInputSchema)
    .output(deleteAssignmentOutputSchema),
};
