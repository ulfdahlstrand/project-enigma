import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import type { createAssignmentInputSchema } from "@cv-tool/contracts";

type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;

export async function createAssignment(db: Kysely<Database>, input: CreateAssignmentInput) {
  return db.transaction().execute(async (trx) => {
    // Insert identity record only
    const identity = await trx
      .insertInto("assignments")
      .values({ employee_id: input.employeeId })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Insert full content into branch_assignments
    const ba = await trx
      .insertInto("branch_assignments")
      .values({
        branch_id: input.branchId,
        assignment_id: identity.id,
        client_name: input.clientName,
        role: input.role,
        description: input.description ?? "",
        start_date: new Date(input.startDate),
        end_date: input.endDate ? new Date(input.endDate) : null,
        technologies: input.technologies ?? [],
        is_current: input.isCurrent ?? false,
        keywords: input.keywords ?? null,
        type: input.type ?? null,
        highlight: input.highlight ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: ba.id,
      assignmentId: identity.id,
      branchId: ba.branch_id,
      employeeId: identity.employee_id,
      clientName: ba.client_name,
      role: ba.role,
      description: ba.description,
      startDate: ba.start_date,
      endDate: ba.end_date,
      technologies: ba.technologies,
      isCurrent: ba.is_current,
      keywords: ba.keywords,
      type: ba.type,
      highlight: ba.highlight,
      sortOrder: ba.sort_order,
      createdAt: ba.created_at,
      updatedAt: ba.updated_at,
    };
  });
}

export const createAssignmentHandler = implement(contract.createAssignment).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createAssignment(getDb(), input);
  }
);

export function createCreateAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.createAssignment).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return createAssignment(db, input);
    }
  );
}
