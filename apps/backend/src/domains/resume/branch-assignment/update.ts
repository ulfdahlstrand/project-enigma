import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { updateBranchAssignmentInputSchema, updateBranchAssignmentOutputSchema } from "@cv-tool/contracts";

type UpdateBranchAssignmentInput = z.infer<typeof updateBranchAssignmentInputSchema>;
type UpdateBranchAssignmentOutput = z.infer<typeof updateBranchAssignmentOutputSchema>;

export async function updateBranchAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateBranchAssignmentInput
): Promise<UpdateBranchAssignmentOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const existing = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("resume_branches as rb", "rb.id", "ba.branch_id")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .innerJoin("assignments as a", "a.id", "ba.assignment_id")
    .select(["ba.id", "r.employee_id", "a.employee_id as assignment_employee_id"])
    .where("ba.id", "=", input.id)
    .executeTakeFirst();

  if (existing === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && existing.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.clientName !== undefined) updates.client_name = input.clientName;
  if (input.role !== undefined) updates.role = input.role;
  if (input.description !== undefined) updates.description = input.description;
  if (input.startDate !== undefined) updates.start_date = new Date(input.startDate);
  if (input.endDate !== undefined) updates.end_date = input.endDate ? new Date(input.endDate) : null;
  if (input.technologies !== undefined) updates.technologies = input.technologies;
  if (input.isCurrent !== undefined) updates.is_current = input.isCurrent;
  if (input.keywords !== undefined) updates.keywords = input.keywords;
  if (input.type !== undefined) updates.type = input.type;
  if (input.highlight !== undefined) updates.highlight = input.highlight;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

  const updated = await db
    .updateTable("branch_assignments")
    .set(updates)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: updated.id,
    assignmentId: updated.assignment_id,
    branchId: updated.branch_id,
    employeeId: existing.assignment_employee_id,
    clientName: updated.client_name,
    role: updated.role,
    description: updated.description,
    startDate: updated.start_date,
    endDate: updated.end_date,
    technologies: updated.technologies,
    isCurrent: updated.is_current,
    keywords: updated.keywords,
    type: updated.type,
    highlight: updated.highlight,
    sortOrder: updated.sort_order,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

export const updateBranchAssignmentHandler = implement(contract.updateBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateBranchAssignment(getDb(), user, input);
  }
);

export function createUpdateBranchAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.updateBranchAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return updateBranchAssignment(db, user, input);
    }
  );
}
