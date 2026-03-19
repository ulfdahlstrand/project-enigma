import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { rowToAssignment } from "../lib/row-to-assignment.js";
import type { createAssignmentInputSchema } from "@cv-tool/contracts";

type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;

export async function createAssignment(db: Kysely<Database>, input: CreateAssignmentInput) {
  if (input.branchId) {
    return db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("assignments")
        .values({
          employee_id: input.employeeId,
          resume_id: input.resumeId ?? null,
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

      await trx
        .insertInto("branch_assignments")
        .values({ branch_id: input.branchId!, assignment_id: row.id })
        .execute();

      return rowToAssignment(row);
    });
  }

  const row = await db
    .insertInto("assignments")
    .values({
      employee_id: input.employeeId,
      resume_id: input.resumeId ?? null,
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

  return rowToAssignment(row);
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
