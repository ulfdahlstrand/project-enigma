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
import type { listBranchAssignmentsInputSchema, listBranchAssignmentsOutputSchema } from "@cv-tool/contracts";

type ListBranchAssignmentsInput = z.infer<typeof listBranchAssignmentsInputSchema>;
type ListBranchAssignmentsOutput = z.infer<typeof listBranchAssignmentsOutputSchema>;

export async function listBranchAssignments(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListBranchAssignmentsInput
): Promise<ListBranchAssignmentsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify branch exists and check ownership
  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return branch.content.assignments.map((assignment) => ({
    id: assignment.assignmentId,
    branchId: branch.branchId,
    assignmentId: assignment.assignmentId,
    highlight: assignment.highlight,
    sortOrder: assignment.sortOrder,
  }));
}

export const listBranchAssignmentsHandler = implement(contract.listBranchAssignments).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listBranchAssignments(getDb(), user, input);
  }
);

export function createListBranchAssignmentsHandler(db: Kysely<Database>) {
  return implement(contract.listBranchAssignments).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listBranchAssignments(db, user, input);
    }
  );
}
