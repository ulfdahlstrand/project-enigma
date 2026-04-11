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
import type { addBranchAssignmentInputSchema, addBranchAssignmentOutputSchema } from "@cv-tool/contracts";

type AddBranchAssignmentInput = z.infer<typeof addBranchAssignmentInputSchema>;
type AddBranchAssignmentOutput = z.infer<typeof addBranchAssignmentOutputSchema>;

export async function addBranchAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: AddBranchAssignmentInput,
  expectedResumeId?: string,
): Promise<AddBranchAssignmentOutput> {
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

  const assignment = await db
    .selectFrom("assignments")
    .select("employee_id")
    .where("id", "=", input.assignmentId)
    .where("deleted_at", "is", null)
    .executeTakeFirst();

  if (assignment === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (assignment.employee_id !== branch.employeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const nextAssignment = {
    assignmentId: input.assignmentId,
    clientName: input.clientName,
    role: input.role,
    description: input.description ?? "",
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    technologies: input.technologies ?? [],
    isCurrent: input.isCurrent ?? false,
    keywords: input.keywords ?? null,
    type: input.type ?? null,
    highlight: input.highlight ?? false,
    sortOrder: input.sortOrder ?? null,
  };

  await upsertBranchContentFromLive(db, {
    resumeId: branch.resumeId,
    branchId: branch.branchId,
    userId: user.id,
    assignments: [...branch.content.assignments, nextAssignment],
  });

  return {
    id: nextAssignment.assignmentId,
    assignmentId: nextAssignment.assignmentId,
    branchId: branch.branchId,
    employeeId: assignment.employee_id,
    clientName: nextAssignment.clientName,
    role: nextAssignment.role,
    description: nextAssignment.description,
    startDate: nextAssignment.startDate,
    endDate: nextAssignment.endDate,
    technologies: nextAssignment.technologies,
    isCurrent: nextAssignment.isCurrent,
    keywords: nextAssignment.keywords,
    type: nextAssignment.type,
    highlight: nextAssignment.highlight,
    sortOrder: nextAssignment.sortOrder,
    createdAt: branch.createdAt,
    updatedAt: new Date(),
  };
}

export const addBranchAssignmentHandler = implement(contract.addBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return addBranchAssignment(getDb(), user, input);
  }
);

export const addResumeBranchAssignmentHandler = implement(contract.addResumeBranchAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return addBranchAssignment(getDb(), user, input, input.resumeId);
  },
);

export function createAddBranchAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.addBranchAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return addBranchAssignment(db, user, input);
    }
  );
}
