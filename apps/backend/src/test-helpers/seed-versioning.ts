import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export const INTEGRATION_ADMIN_USER = {
  id: "10000000-0000-4000-8000-000000000001",
  google_sub: "integration-admin-sub",
  email: "integration-admin@example.com",
  name: "Integration Admin",
  role: "admin" as const,
};

export const INTEGRATION_EMPLOYEE = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Integration Employee",
  email: "integration-employee@example.com",
};

export async function seedIntegrationAdmin(db: Kysely<Database>) {
  await db
    .insertInto("users")
    .values(INTEGRATION_ADMIN_USER)
    .execute();
}

export async function seedIntegrationEmployee(db: Kysely<Database>) {
  await db
    .insertInto("employees")
    .values(INTEGRATION_EMPLOYEE)
    .execute();
}

export async function seedMainBranchAssignment(
  db: Kysely<Database>,
  input: {
    branchId: string;
    employeeId: string;
    clientName: string;
    role: string;
    description: string;
    startDate?: Date;
  },
) {
  const assignment = await db
    .insertInto("assignments")
    .values({
      employee_id: input.employeeId,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const branchAssignment = await db
    .insertInto("branch_assignments")
    .values({
      branch_id: input.branchId,
      assignment_id: assignment.id,
      client_name: input.clientName,
      role: input.role,
      description: input.description,
      start_date: input.startDate ?? new Date("2025-01-01T00:00:00.000Z"),
      end_date: null,
      technologies: ["TypeScript"],
      is_current: true,
      keywords: null,
      type: null,
      highlight: true,
      sort_order: 0,
    })
    .returning(["id", "assignment_id"])
    .executeTakeFirstOrThrow();

  return {
    branchAssignmentId: branchAssignment.id,
    assignmentId: branchAssignment.assignment_id,
  };
}
