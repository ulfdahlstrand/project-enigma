import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { createCommitTagInputSchema, createCommitTagOutputSchema } from "@cv-tool/contracts";

type CreateCommitTagInput = z.infer<typeof createCommitTagInputSchema>;
type CreateCommitTagOutput = z.infer<typeof createCommitTagOutputSchema>;

export async function createCommitTag(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateCommitTagInput
): Promise<CreateCommitTagOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const sourceCommit = await db
    .selectFrom("resume_commits as rc")
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .select(["rc.resume_id", "r.employee_id"])
    .where("rc.id", "=", input.sourceCommitId)
    .executeTakeFirst();

  if (!sourceCommit) {
    throw new ORPCError("NOT_FOUND", { message: "Source commit not found" });
  }

  if (ownerEmployeeId !== null && sourceCommit.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const targetCommit = await db
    .selectFrom("resume_commits as rc")
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .select(["rc.resume_id", "r.employee_id"])
    .where("rc.id", "=", input.targetCommitId)
    .executeTakeFirst();

  if (!targetCommit) {
    throw new ORPCError("NOT_FOUND", { message: "Target commit not found" });
  }

  if (sourceCommit.resume_id === targetCommit.resume_id) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Source and target commits must belong to different resumes",
    });
  }

  const kind = input.kind ?? "translation";

  const tag = await db
    .insertInto("commit_tags")
    .values({
      source_resume_id: sourceCommit.resume_id,
      target_resume_id: targetCommit.resume_id,
      source_commit_id: input.sourceCommitId,
      target_commit_id: input.targetCommitId,
      kind,
      created_by: ownerEmployeeId,
    })
    .onConflict((oc) =>
      oc.constraint("commit_tags_unique_source_target_resume_kind").doUpdateSet({
        source_commit_id: input.sourceCommitId,
        target_commit_id: input.targetCommitId,
        created_by: userId,
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: tag.id,
    sourceCommitId: tag.source_commit_id,
    targetCommitId: tag.target_commit_id,
    kind: tag.kind,
    createdAt: tag.created_at,
    createdBy: tag.created_by,
  };
}

export const createCommitTagHandler = implement(contract.createCommitTag).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createCommitTag(getDb(), user, input);
  }
);

export function createCreateCommitTagHandler(db: Kysely<Database>) {
  return implement(contract.createCommitTag).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createCommitTag(db, user, input);
    }
  );
}
