import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { addBranchAssignmentInputSchema, addBranchAssignmentOutputSchema } from "@cv-tool/contracts";

type AddBranchAssignmentInput = z.infer<typeof addBranchAssignmentInputSchema>;
type AddBranchAssignmentOutput = z.infer<typeof addBranchAssignmentOutputSchema>;

export async function addBranchAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: AddBranchAssignmentInput
): Promise<AddBranchAssignmentOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify branch exists and check ownership
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["rb.id", "r.employee_id"])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  // Verify the assignment belongs to the same employee as the branch's resume
  const assignment = await db
    .selectFrom("assignments")
    .select("employee_id")
    .where("id", "=", input.assignmentId)
    .executeTakeFirst();

  if (assignment === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (assignment.employee_id !== branch.employee_id) {
    throw new ORPCError("FORBIDDEN");
  }

  const row = await db
    .insertInto("branch_assignments")
    .values({
      branch_id: input.branchId,
      assignment_id: input.assignmentId,
      highlight: input.highlight ?? false,
      sort_order: input.sortOrder ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    branchId: row.branch_id,
    assignmentId: row.assignment_id,
    highlight: row.highlight,
    sortOrder: row.sort_order,
  };
}

export const addBranchAssignmentHandler = implement(contract.addBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return addBranchAssignment(getDb(), user, input);
  }
);

export function createAddBranchAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.addBranchAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return addBranchAssignment(db, user, input);
    }
  );
}
