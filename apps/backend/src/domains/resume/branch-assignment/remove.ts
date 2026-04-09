import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";
import type { removeBranchAssignmentInputSchema, removeBranchAssignmentOutputSchema } from "@cv-tool/contracts";

type RemoveBranchAssignmentInput = z.infer<typeof removeBranchAssignmentInputSchema>;
type RemoveBranchAssignmentOutput = z.infer<typeof removeBranchAssignmentOutputSchema>;

export async function removeBranchAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: RemoveBranchAssignmentInput
): Promise<RemoveBranchAssignmentOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const nextAssignments = branch.content.assignments.filter(
    (assignment) => assignment.assignmentId !== input.id,
  );

  if (nextAssignments.length === branch.content.assignments.length) {
    throw new ORPCError("NOT_FOUND");
  }

  await upsertBranchContentFromLive(db, {
    resumeId: branch.resumeId,
    branchId: branch.branchId,
    userId: user.id,
    assignments: nextAssignments,
  });

  return { deleted: true };
}

export const removeBranchAssignmentHandler = implement(contract.removeBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return removeBranchAssignment(getDb(), user, input);
  }
);

export function createRemoveBranchAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.removeBranchAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return removeBranchAssignment(db, user, input);
    }
  );
}
