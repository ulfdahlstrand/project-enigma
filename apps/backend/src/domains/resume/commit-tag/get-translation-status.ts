import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { getTranslationStatusInputSchema, getTranslationStatusOutputSchema } from "@cv-tool/contracts";

type GetTranslationStatusInput = z.infer<typeof getTranslationStatusInputSchema>;
type GetTranslationStatusOutput = z.infer<typeof getTranslationStatusOutputSchema>;

export async function getTranslationStatus(
  db: Kysely<Database>,
  user: AuthUser,
  input: GetTranslationStatusInput
): Promise<GetTranslationStatusOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const sourceResume = await db
    .selectFrom("resumes as r")
    .select(["r.employee_id"])
    .where("r.id", "=", input.resumeId)
    .executeTakeFirst();

  if (!sourceResume) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && sourceResume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const tag = await db
    .selectFrom("commit_tags as ct")
    .select([
      "ct.id",
      "ct.source_commit_id",
      "ct.target_commit_id",
      "ct.kind",
      "ct.created_at",
      "ct.created_by",
    ])
    .where("ct.source_resume_id", "=", input.resumeId)
    .where("ct.target_resume_id", "=", input.targetResumeId)
    .executeTakeFirst();

  if (!tag) {
    return { latestTag: null, isStale: false, sourceHeadCommitId: null };
  }

  const sourceBranch = await db
    .selectFrom("resume_branches as rb")
    .select(["rb.head_commit_id"])
    .where("rb.resume_id", "=", input.resumeId)
    .where("rb.is_main", "=", true)
    .executeTakeFirst();

  const sourceHeadCommitId = sourceBranch?.head_commit_id ?? null;
  const isStale = sourceHeadCommitId !== null && sourceHeadCommitId !== tag.source_commit_id;

  return {
    latestTag: {
      id: tag.id,
      sourceCommitId: tag.source_commit_id,
      targetCommitId: tag.target_commit_id,
      kind: tag.kind,
      createdAt: tag.created_at,
      createdBy: tag.created_by,
    },
    isStale,
    sourceHeadCommitId,
  };
}

export const getTranslationStatusHandler = implement(contract.getTranslationStatus).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getTranslationStatus(getDb(), user, input);
  }
);

export function createGetTranslationStatusHandler(db: Kysely<Database>) {
  return implement(contract.getTranslationStatus).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getTranslationStatus(db, user, input);
    }
  );
}
