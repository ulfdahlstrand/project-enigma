import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { createTranslationBranchInputSchema, createTranslationBranchOutputSchema } from "@cv-tool/contracts";

type CreateTranslationBranchInput = z.infer<typeof createTranslationBranchInputSchema>;
type CreateTranslationBranchOutput = z.infer<typeof createTranslationBranchOutputSchema>;

export async function createTranslationBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateTranslationBranchInput,
): Promise<CreateTranslationBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const sourceBranch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.name",
      "rb.language",
      "rb.head_commit_id",
      "rb.branch_type",
      "r.employee_id",
    ])
    .where("rb.id", "=", input.sourceBranchId)
    .executeTakeFirst();

  if (sourceBranch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && sourceBranch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (sourceBranch.branch_type !== "variant") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Translation branches can only be created from variant branches",
    });
  }

  if (sourceBranch.head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Source branch has no commits — save at least one version before creating a translation",
    });
  }

  const name = input.name ?? `${sourceBranch.name}-${input.language}`;

  const newBranch = await db
    .insertInto("resume_branches")
    .values({
      resume_id: sourceBranch.resume_id,
      name,
      language: input.language,
      is_main: false,
      head_commit_id: sourceBranch.head_commit_id,
      forked_from_commit_id: sourceBranch.head_commit_id,
      created_by: user.id,
      branch_type: "translation",
      source_branch_id: input.sourceBranchId,
      source_commit_id: sourceBranch.head_commit_id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: newBranch.id,
    resumeId: newBranch.resume_id,
    name: newBranch.name,
    language: newBranch.language,
    isMain: newBranch.is_main,
    headCommitId: newBranch.head_commit_id,
    forkedFromCommitId: newBranch.forked_from_commit_id,
    createdBy: newBranch.created_by,
    createdAt: newBranch.created_at,
    branchType: newBranch.branch_type,
    sourceBranchId: newBranch.source_branch_id,
    sourceCommitId: newBranch.source_commit_id,
    isStale: false,
    isArchived: newBranch.is_archived,
  };
}

export const createTranslationBranchHandler = implement(contract.createTranslationBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createTranslationBranch(getDb(), user, input);
  },
);

export function createCreateTranslationBranchHandler(db: Kysely<Database>) {
  return implement(contract.createTranslationBranch).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createTranslationBranch(db, user, input);
    },
  );
}
