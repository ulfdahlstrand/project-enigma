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
} from "./employees.js";

// ---------------------------------------------------------------------------
// Health procedure — Zod schemas
// ---------------------------------------------------------------------------

export const healthInputSchema = z.object({
  echo: z.string().optional(),
});

export const healthOutputSchema = z.object({
  status: z.literal("ok"),
  echo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Test entries procedure — Zod schemas
//
// These schemas back the `listTestEntries` procedure, which queries the
// `test_entries` table created by the initial migration. They exist solely
// to validate the full end-to-end stack (database → oRPC → TanStack Query →
// React route) and carry no CV-specific business logic.
// ---------------------------------------------------------------------------

export const listTestEntriesInputSchema = z.object({});

export const testEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string(),
});

export const listTestEntriesOutputSchema = z.object({
  entries: z.array(testEntrySchema),
});

export type TestEntry = z.infer<typeof testEntrySchema>;

// ---------------------------------------------------------------------------
// Employee schemas — re-exported from ./employees
// ---------------------------------------------------------------------------

export {
  employeeSchema,
  listEmployeesOutputSchema,
  getEmployeeInputSchema,
  getEmployeeOutputSchema,
  createEmployeeInputSchema,
  createEmployeeOutputSchema,
  updateEmployeeInputSchema,
  updateEmployeeOutputSchema,
} from "./employees.js";
export type { Employee } from "./employees.js";

// ---------------------------------------------------------------------------
// Router contract
//
// Defines the shape of every procedure (input + output schemas) without any
// implementation. The backend imports this contract and attaches handlers;
// the frontend imports the inferred AppRouter type for a fully-typed client.
// ---------------------------------------------------------------------------

export const contract = oc.router({
  health: oc.input(healthInputSchema).output(healthOutputSchema),
  listTestEntries: oc
    .input(listTestEntriesInputSchema)
    .output(listTestEntriesOutputSchema),
  listEmployees: oc
    .input(z.object({}))
    .output(listEmployeesOutputSchema),
  getEmployee: oc
    .input(getEmployeeInputSchema)
    .output(getEmployeeOutputSchema),
  createEmployee: oc
    .input(createEmployeeInputSchema)
    .output(createEmployeeOutputSchema),
  updateEmployee: oc
    .input(updateEmployeeInputSchema)
    .output(updateEmployeeOutputSchema),
});

/** Inferred contract type — used by the frontend to create a typed oRPC client. */
export type AppRouter = typeof contract;
