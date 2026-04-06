import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import type { updateResumeSkillGroupInputSchema } from "@cv-tool/contracts";

type Input = z.infer<typeof updateResumeSkillGroupInputSchema>;

export async function updateResumeSkillGroup(db: Kysely<Database>, input: Input) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

  const row = await db
    .updateTable("resume_skill_groups")
    .set(updates)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Skill group not found" });
  }

  return {
    id: row.id,
    resumeId: row.resume_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

export const updateResumeSkillGroupHandler = implement(contract.updateResumeSkillGroup).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateResumeSkillGroup(getDb(), input);
  },
);
