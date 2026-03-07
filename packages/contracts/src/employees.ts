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
