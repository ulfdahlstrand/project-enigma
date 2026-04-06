import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import type { createResumeSkillGroupInputSchema } from "@cv-tool/contracts";

type Input = z.infer<typeof createResumeSkillGroupInputSchema>;

export async function createResumeSkillGroup(db: Kysely<Database>, input: Input) {
  const row = await db
    .insertInto("resume_skill_groups")
    .values({
      resume_id: input.resumeId,
      name: input.name,
      sort_order: input.sortOrder ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: row.id,
    resumeId: row.resume_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

export const createResumeSkillGroupHandler = implement(contract.createResumeSkillGroup).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return createResumeSkillGroup(getDb(), input);
  },
);
