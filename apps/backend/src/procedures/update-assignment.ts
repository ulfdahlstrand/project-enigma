import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, AssignmentUpdate } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthContext } from "../auth/require-auth.js";
import { rowToAssignment } from "./list-assignments.js";
import type { updateAssignmentInputSchema } from "@cv-tool/contracts";

type UpdateAssignmentInput = z.infer<typeof updateAssignmentInputSchema>;

export async function updateAssignment(db: Kysely<Database>, input: UpdateAssignmentInput) {
  const update: AssignmentUpdate = {};
  if (input.resumeId !== undefined) update.resume_id = input.resumeId;
  if (input.clientName !== undefined) update.client_name = input.clientName;
  if (input.role !== undefined) update.role = input.role;
  if (input.description !== undefined) update.description = input.description;
  if (input.startDate !== undefined) update.start_date = new Date(input.startDate);
  if (input.endDate !== undefined) update.end_date = input.endDate ? new Date(input.endDate) : null;
  if (input.technologies !== undefined) update.technologies = input.technologies;
  if (input.isCurrent !== undefined) update.is_current = input.isCurrent;

  const row = await db
    .updateTable("assignments")
    .set({ ...update, updated_at: new Date() })
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
  }

  return rowToAssignment(row);
}

export const updateAssignmentHandler = implement(contract.updateAssignment).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateAssignment(getDb(), input);
  }
);

export function createUpdateAssignmentHandler(db: Kysely<Database>) {
  return implement(contract.updateAssignment).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return updateAssignment(db, input);
    }
  );
}
