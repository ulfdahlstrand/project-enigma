import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { normaliseAssignmentIds, syncBranchAssignmentsFromContent } from "../lib/sync-branch-assignments.js";
import { syncLiveResumeFromContent } from "../lib/sync-live-resume-from-content.js";
import type { finaliseResumeBranchInputSchema, finaliseResumeBranchOutputSchema } from "@cv-tool/contracts";

type FinaliseResumeBranchInput = z.infer<typeof finaliseResumeBranchInputSchema>;
type FinaliseResumeBranchOutput = z.infer<typeof finaliseResumeBranchOutputSchema>;

export async function finaliseResumeBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: FinaliseResumeBranchInput
): Promise<FinaliseResumeBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branches = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.head_commit_id",
      "r.employee_id",
    ])
    .where("rb.id", "in", [input.sourceBranchId, input.revisionBranchId])
    .execute();

  const sourceBranch = branches.find((branch) => branch.id === input.sourceBranchId);
  const revisionBranch = branches.find((branch) => branch.id === input.revisionBranchId);

  if (!sourceBranch || !revisionBranch) {
    throw new ORPCError("NOT_FOUND");
  }

  if (sourceBranch.resume_id !== revisionBranch.resume_id) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Both branches must belong to the same resume.",
    });
  }

  if (ownerEmployeeId !== null && sourceBranch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (input.action === "keep" || input.sourceBranchId === input.revisionBranchId) {
    return { resultBranchId: input.revisionBranchId };
  }

  if (revisionBranch.head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Revision branch has no HEAD commit.",
    });
  }

  const revisionCommit = await db
    .selectFrom("resume_commits")
    .select(["content"])
    .where("id", "=", revisionBranch.head_commit_id)
    .executeTakeFirst();

  if (!revisionCommit) {
    throw new ORPCError("NOT_FOUND");
  }

  const normalisedContent = await normaliseAssignmentIds(
    db,
    sourceBranch.employee_id,
    revisionCommit.content as ResumeCommitContent
  );

  await db.transaction().execute(async (trx) => {
    const mergeCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: sourceBranch.resume_id,
        branch_id: sourceBranch.id,
        content: JSON.stringify(normalisedContent),
        message: "Merge inline AI revision",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const mergeParents = [
      sourceBranch.head_commit_id !== null
        ? {
            commit_id: mergeCommit.id,
            parent_commit_id: sourceBranch.head_commit_id,
            parent_order: 0,
          }
        : null,
      {
        commit_id: mergeCommit.id,
        parent_commit_id: revisionBranch.head_commit_id!,
        parent_order: 1,
      },
    ].filter((value): value is NonNullable<typeof value> => value !== null);

    if (mergeParents.length > 0) {
      await trx.insertInto("resume_commit_parents").values(mergeParents).execute();
    }

    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: mergeCommit.id })
      .where("id", "=", sourceBranch.id)
      .execute();

    await syncBranchAssignmentsFromContent(trx, sourceBranch.id, normalisedContent);

    const sourceBranchMeta = await trx
      .selectFrom("resume_branches")
      .select(["is_main"])
      .where("id", "=", sourceBranch.id)
      .executeTakeFirst();

    if (sourceBranchMeta?.is_main) {
      await syncLiveResumeFromContent(trx, sourceBranch.resume_id, normalisedContent);
    }
  });

  return { resultBranchId: sourceBranch.id };
}

export const finaliseResumeBranchHandler = implement(contract.finaliseResumeBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return finaliseResumeBranch(getDb(), user, input);
  }
);
