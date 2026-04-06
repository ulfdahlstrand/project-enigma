import { oc } from "@orpc/contract";
import {
  listEducationInputSchema,
  listEducationOutputSchema,
  createEducationInputSchema,
  createEducationOutputSchema,
  deleteEducationInputSchema,
  deleteEducationOutputSchema,
} from "../../education.js";

export const educationRoutes = {
  listEducation: oc
    .route({ method: "GET", path: "/employees/{employeeId}/education" })
    .input(listEducationInputSchema)
    .output(listEducationOutputSchema),
  createEducation: oc
    .route({ method: "POST", path: "/employees/{employeeId}/education" })
    .input(createEducationInputSchema)
    .output(createEducationOutputSchema),
  deleteEducation: oc
    .route({ method: "DELETE", path: "/employees/{employeeId}/education/{id}" })
    .input(deleteEducationInputSchema)
    .output(deleteEducationOutputSchema),
};
