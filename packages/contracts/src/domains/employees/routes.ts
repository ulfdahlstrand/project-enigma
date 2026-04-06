import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  listEmployeesOutputSchema,
  getEmployeeInputSchema,
  getEmployeeOutputSchema,
  createEmployeeInputSchema,
  createEmployeeOutputSchema,
  updateEmployeeInputSchema,
  updateEmployeeOutputSchema,
  deleteEmployeeInputSchema,
  deleteEmployeeOutputSchema,
} from "../../employees.js";

export const employeeRoutes = {
  listEmployees: oc
    .route({ method: "GET", path: "/employees" })
    .input(z.object({}))
    .output(listEmployeesOutputSchema),
  getEmployee: oc
    .route({ method: "GET", path: "/employees/{id}" })
    .input(getEmployeeInputSchema)
    .output(getEmployeeOutputSchema),
  createEmployee: oc
    .route({ method: "POST", path: "/employees" })
    .input(createEmployeeInputSchema)
    .output(createEmployeeOutputSchema),
  updateEmployee: oc
    .route({ method: "PATCH", path: "/employees/{id}" })
    .input(updateEmployeeInputSchema)
    .output(updateEmployeeOutputSchema),
  deleteEmployee: oc
    .route({ method: "DELETE", path: "/employees/{id}" })
    .input(deleteEmployeeInputSchema)
    .output(deleteEmployeeOutputSchema),
};
