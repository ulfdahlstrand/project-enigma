import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type {
  archiveResumeBranchInputSchema,
  archiveResumeBranchOutputSchema,
} from "@cv-tool/contracts";

type ArchiveResumeBranchInput = z.infer<typeof archiveResumeBranchInputSchema>;
type ArchiveResumeBranchOutput = z.infer<typeof archiveResumeBranchOutputSchema>;

export async function archiveResumeBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: ArchiveResumeBranchInput,
): Promise<ArchiveResumeBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.name",
      "rb.language",
      "rb.is_main",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "rb.created_by",
      "rb.created_at",
      "rb.branch_type",
      "rb.source_branch_id",
      "rb.source_commit_id",
      "rb.is_archived",
      "r.employee_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (!branch) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (branch.is_main && input.isArchived) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Main branch cannot be archived.",
    });
  }

  const updated = await db
    .updateTable("resume_branches")
    .set({ is_archived: input.isArchived })
    .where("id", "=", input.branchId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: updated.id,
    resumeId: updated.resume_id,
    name: updated.name,
    isMain: updated.is_main,
    headCommitId: updated.head_commit_id,
    forkedFromCommitId: updated.forked_from_commit_id,
    createdBy: updated.created_by,
    createdAt: updated.created_at,
    branchType: updated.branch_type,
    sourceBranchId: updated.source_branch_id,
    sourceCommitId: updated.source_commit_id,
    isArchived: updated.is_archived,
  };
}

export const archiveResumeBranchHandler = implement(contract.archiveResumeBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return archiveResumeBranch(getDb(), user, input);
  },
);

export function createArchiveResumeBranchHandler(db: Kysely<Database>) {
  return implement(contract.archiveResumeBranch).handler(async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return archiveResumeBranch(db, user, input);
  });
}
