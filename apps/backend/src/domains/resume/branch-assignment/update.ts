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

  // Fetch the branch_assignment row with ownership info via join
  const existing = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("resume_branches as rb", "rb.id", "ba.branch_id")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["ba.id", "r.employee_id"])
    .where("ba.id", "=", input.id)
    .executeTakeFirst();

  if (existing === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && existing.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const updates = {
    ...(input.highlight !== undefined ? { highlight: input.highlight } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  };

  const updated = await db
    .updateTable("branch_assignments")
    .set(updates)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: updated.id,
    branchId: updated.branch_id,
    assignmentId: updated.assignment_id,
    highlight: updated.highlight,
    sortOrder: updated.sort_order,
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
