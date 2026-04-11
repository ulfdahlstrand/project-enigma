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
import type { updateBranchAssignmentInputSchema, updateBranchAssignmentOutputSchema } from "@cv-tool/contracts";

type UpdateBranchAssignmentInput = z.infer<typeof updateBranchAssignmentInputSchema>;
type UpdateBranchAssignmentOutput = z.infer<typeof updateBranchAssignmentOutputSchema>;

export async function updateBranchAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: UpdateBranchAssignmentInput,
  expectedResumeId?: string,
): Promise<UpdateBranchAssignmentOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (branch === null) {
    throw new ORPCError("NOT_FOUND");
  }

  if (expectedResumeId && branch.resumeId !== expectedResumeId) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const existing = branch.content.assignments.find((assignment) =>
    assignment.assignmentId === input.id,
  );
  if (!existing) {
    throw new ORPCError("NOT_FOUND");
  }

  const nextAssignments = branch.content.assignments.map((assignment) =>
    assignment.assignmentId === input.id
      ? {
          ...assignment,
          ...(input.clientName !== undefined ? { clientName: input.clientName } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.technologies !== undefined ? { technologies: input.technologies } : {}),
          ...(input.isCurrent !== undefined ? { isCurrent: input.isCurrent } : {}),
          ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.highlight !== undefined ? { highlight: input.highlight } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        }
      : assignment,
  );

  await upsertBranchContentFromLive(db, {
    resumeId: branch.resumeId,
    branchId: branch.branchId,
    userId: user.id,
    assignments: nextAssignments,
  });

  const updated = nextAssignments.find((assignment) => assignment.assignmentId === input.id)!;

  return {
    id: updated.assignmentId,
    assignmentId: updated.assignmentId,
    branchId: branch.branchId,
    employeeId: branch.employeeId,
    clientName: updated.clientName,
    role: updated.role,
    description: updated.description,
    startDate: updated.startDate,
    endDate: updated.endDate,
    technologies: updated.technologies,
    isCurrent: updated.isCurrent,
    keywords: updated.keywords,
    type: updated.type,
    highlight: updated.highlight,
    sortOrder: updated.sortOrder,
    createdAt: branch.createdAt,
    updatedAt: new Date(),
  };
}

export const updateBranchAssignmentHandler = implement(contract.updateBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateBranchAssignment(getDb(), user, input);
  }
);

export const updateResumeBranchAssignmentHandler = implement(contract.updateResumeBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return updateBranchAssignment(getDb(), user, input, input.resumeId);
  },
);

export function createUpdateBranchAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.updateBranchAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return updateBranchAssignment(db, user, input);
    }
  );
}
