import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

export async function deleteResumeSkill(db: Kysely<Database>, id: string) {
  const row = await db
    .deleteFrom("resume_skills")
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Skill not found" });
  }

  return { deleted: true as const };
}

export const deleteResumeSkillHandler = implement(contract.deleteResumeSkill).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return deleteResumeSkill(getDb(), input.id);
  }
);
