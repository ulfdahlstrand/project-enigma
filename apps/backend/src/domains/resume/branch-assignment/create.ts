import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext, type AuthUser } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";
import type { createAssignmentInputSchema } from "@cv-tool/contracts";

type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;

export async function createAssignment(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateAssignmentInput,
) {
  const ownerEmployeeId = await resolveEmployeeId(db, user);
  const branch = await readBranchAssignmentContent(db, input.branchId);

  if (!branch) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return db.transaction().execute(async (trx) => {
    const identity = await trx
      .insertInto("assignments")
      .values({ employee_id: input.employeeId })
      .returningAll()
      .executeTakeFirstOrThrow();

    const nextAssignment = {
      assignmentId: identity.id,
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
      sortOrder: null,
    };

    await upsertBranchContentFromLive(trx, {
      resumeId: branch.resumeId,
      branchId: branch.branchId,
      userId: user.id,
      assignments: [...branch.content.assignments, nextAssignment],
    });

    return {
      id: identity.id,
      assignmentId: identity.id,
      branchId: branch.branchId,
      employeeId: identity.employee_id,
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
      createdAt: identity.created_at,
      updatedAt: identity.created_at,
    };
  });
}

export const createAssignmentHandler = implement(contract.createAssignment).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createAssignment(getDb(), user, input);
  }
);

export function createCreateAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.createAssignment).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createAssignment(db, user, input);
    }
  );
}
