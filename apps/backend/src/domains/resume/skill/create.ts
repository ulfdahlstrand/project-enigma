import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import type { createResumeSkillInputSchema } from "@cv-tool/contracts";

type Input = z.infer<typeof createResumeSkillInputSchema>;

export async function createResumeSkill(db: Kysely<Database>, input: Input) {
  const row = await db
    .insertInto("resume_skills")
    .values({
      cv_id: input.resumeId,
      name: input.name,
      level: input.level ?? null,
      category: input.category ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    resumeId: row.cv_id,
    name: row.name,
    level: row.level,
    category: row.category,
    sortOrder: row.sort_order,
  };
}

export const createResumeSkillHandler = implement(contract.createResumeSkill).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createResumeSkill(getDb(), input);
  }
);
