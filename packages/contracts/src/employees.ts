import { z } from "zod";

// ---------------------------------------------------------------------------
// Employee schemas
//
// Shared between frontend and backend via @cv-tool/contracts.
//
// `created_at` / `updated_at` accept both `string` (ISO-8601 serialised) and
// `Date` objects so the schemas remain compatible whether the backend returns
// plain-JS Date instances from Kysely or serialised strings from JSON.
// ---------------------------------------------------------------------------

export const employeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]),
});

export const listEmployeesOutputSchema = z.array(employeeSchema);

/** Inferred TypeScript type for a single employee record. */
export type Employee = z.infer<typeof employeeSchema>;

// ---------------------------------------------------------------------------
// getEmployee schemas
// ---------------------------------------------------------------------------

export const getEmployeeInputSchema = z.object({
  id: z.string().uuid(),
});

export const getEmployeeOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// ---------------------------------------------------------------------------
// createEmployee schemas
// ---------------------------------------------------------------------------

export const createEmployeeInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export const createEmployeeOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// ---------------------------------------------------------------------------
// updateEmployee schemas
// ---------------------------------------------------------------------------

export const updateEmployeeInputSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.email !== undefined,
    { message: "At least one field must be provided" }
  );

export const updateEmployeeOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// ---------------------------------------------------------------------------
// deleteEmployee schemas
// ---------------------------------------------------------------------------

export const deleteEmployeeInputSchema = z.object({
  id: z.string().uuid(),
});

export const deleteEmployeeOutputSchema = z.object({
  deleted: z.literal(true),
});
