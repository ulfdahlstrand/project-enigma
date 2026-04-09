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
import type {
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "@cv-tool/contracts";

type ListBranchAssignmentsFullInput = z.infer<typeof listBranchAssignmentsFullInputSchema>;
type ListBranchAssignmentsFullOutput = z.infer<typeof listBranchAssignmentsFullOutputSchema>;

export async function listBranchAssignmentsFull(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListBranchAssignmentsFullInput
): Promise<ListBranchAssignmentsFullOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return branch.content.assignments.map((assignment) => ({
    id: assignment.assignmentId,
    assignmentId: assignment.assignmentId,
    branchId: branch.branchId,
    employeeId: branch.employeeId,
    clientName: assignment.clientName,
    role: assignment.role,
    description: assignment.description,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    technologies: assignment.technologies,
    isCurrent: assignment.isCurrent,
    keywords: assignment.keywords,
    type: assignment.type,
    highlight: assignment.highlight,
    sortOrder: assignment.sortOrder,
    createdAt: branch.createdAt,
    updatedAt: branch.createdAt,
  }));
}

export const listBranchAssignmentsFullHandler = implement(contract.listBranchAssignmentsFull).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listBranchAssignmentsFull(getDb(), user, input);
  }
);

export function createListBranchAssignmentsFullHandler(db: Kysely<Database>) {
  return implement(contract.listBranchAssignmentsFull).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listBranchAssignmentsFull(db, user, input);
    }
  );
}
