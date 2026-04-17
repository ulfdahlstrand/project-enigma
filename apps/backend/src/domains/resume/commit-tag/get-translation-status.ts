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

  // Find the latest tag between the two resumes (source → target direction)
  const latestTag = await db
    .selectFrom("commit_tags as ct")
    .innerJoin("resume_commits as src_rc", "src_rc.id", "ct.source_commit_id")
    .innerJoin("resume_commits as tgt_rc", "tgt_rc.id", "ct.target_commit_id")
    .select([
      "ct.id",
      "ct.source_commit_id",
      "ct.target_commit_id",
      "ct.kind",
      "ct.created_at",
      "ct.created_by",
    ])
    .where("src_rc.resume_id", "=", input.resumeId)
    .where("tgt_rc.resume_id", "=", input.targetResumeId)
    .orderBy("ct.created_at", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!latestTag) {
    return { latestTag: null, isStale: false, sourceHeadCommitId: null };
  }

  // Find the main branch head of the source resume to detect staleness
  const sourceBranch = await db
    .selectFrom("resume_branches as rb")
    .select(["rb.head_commit_id"])
    .where("rb.resume_id", "=", input.resumeId)
    .where("rb.is_main", "=", true)
    .executeTakeFirst();

  const sourceHeadCommitId = sourceBranch?.head_commit_id ?? null;
  const isStale = sourceHeadCommitId !== null && sourceHeadCommitId !== latestTag.source_commit_id;

  return {
    latestTag: {
      id: latestTag.id,
      sourceCommitId: latestTag.source_commit_id,
      targetCommitId: latestTag.target_commit_id,
      kind: latestTag.kind,
      createdAt: latestTag.created_at,
      createdBy: latestTag.created_by,
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
