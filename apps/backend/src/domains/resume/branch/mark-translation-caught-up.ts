import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { markTranslationCaughtUpInputSchema, markTranslationCaughtUpOutputSchema } from "@cv-tool/contracts";

type MarkTranslationCaughtUpInput = z.infer<typeof markTranslationCaughtUpInputSchema>;
type MarkTranslationCaughtUpOutput = z.infer<typeof markTranslationCaughtUpOutputSchema>;

export async function markTranslationCaughtUp(
  db: Kysely<Database>,
  user: AuthUser,
  input: MarkTranslationCaughtUpInput,
): Promise<MarkTranslationCaughtUpOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const translation = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .leftJoin("resume_branches as source_rb", "source_rb.id", "rb.source_branch_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.name",
      "rb.language",
      "rb.is_main",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "rb.branch_type",
      "rb.source_branch_id",
      "rb.source_commit_id",
      "rb.created_by",
      "rb.created_at",
      "r.employee_id",
      "source_rb.head_commit_id as source_head_commit_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (translation === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && translation.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (translation.branch_type !== "translation") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only translation branches can be marked as caught up",
    });
  }

  if (translation.source_head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Source variant has no commits",
    });
  }

  const updated = await db
    .updateTable("resume_branches")
    .set({ source_commit_id: translation.source_head_commit_id })
    .where("id", "=", input.branchId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: updated.id,
    resumeId: updated.resume_id,
    name: updated.name,
    language: updated.language,
    isMain: updated.is_main,
    headCommitId: updated.head_commit_id,
    forkedFromCommitId: updated.forked_from_commit_id,
    createdBy: updated.created_by,
    createdAt: updated.created_at,
    branchType: updated.branch_type,
    sourceBranchId: updated.source_branch_id,
    sourceCommitId: updated.source_commit_id,
    // After marking caught up, source_commit_id == source HEAD → not stale
    isStale: false,
  };
}

export const markTranslationCaughtUpHandler = implement(contract.markTranslationCaughtUp).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return markTranslationCaughtUp(getDb(), user, input);
  },
);

export function createMarkTranslationCaughtUpHandler(db: Kysely<Database>) {
  return implement(contract.markTranslationCaughtUp).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return markTranslationCaughtUp(db, user, input);
    },
  );
}
