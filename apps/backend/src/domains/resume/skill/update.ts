import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import type { updateResumeSkillInputSchema } from "@cv-tool/contracts";

type Input = z.infer<typeof updateResumeSkillInputSchema>;

export async function updateResumeSkill(db: Kysely<Database>, input: Input) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.groupId !== undefined) updates.group_id = input.groupId;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

  const row = await db
    .updateTable("resume_skills")
    .set(updates)
    .where("id", "=", input.id)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Skill not found" });
  }

  const group = await db
    .selectFrom("resume_skill_groups")
    .select(["name", "sort_order"])
    .where("id", "=", row.group_id)
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    resumeId: row.resume_id,
    groupId: row.group_id,
    name: row.name,
    category: group.name,
    sortOrder: row.sort_order,
  };
}

export const updateResumeSkillHandler = implement(contract.updateResumeSkill).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateResumeSkill(getDb(), input);
  }
);

export function createUpdateResumeSkillHandler(db: Kysely<Database>) {
  return implement(contract.updateResumeSkill).handler(async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return updateResumeSkill(db, input);
  });
}
