import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readTreeContent } from "../lib/read-tree-content.js";
import { buildCommitTree } from "../lib/build-commit-tree.js";
import type {
  createTranslationResumeInputSchema,
  createTranslationResumeOutputSchema,
} from "@cv-tool/contracts";

type CreateTranslationResumeInput = z.infer<typeof createTranslationResumeInputSchema>;
type CreateTranslationResumeOutput = z.infer<typeof createTranslationResumeOutputSchema>;

export async function createTranslationResume(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateTranslationResumeInput
): Promise<CreateTranslationResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify source resume exists and user has access
  const sourceResume = await db
    .selectFrom("resumes as r")
    .select(["r.id", "r.employee_id", "r.title"])
    .where("r.id", "=", input.sourceResumeId)
    .executeTakeFirst();

  if (!sourceResume) {
    throw new ORPCError("NOT_FOUND", { message: "Source resume not found" });
  }

  if (ownerEmployeeId !== null && sourceResume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  // Get source resume's main branch head commit + tree
  const sourceBranch = await db
    .selectFrom("resume_branches as rb")
    .select(["rb.head_commit_id"])
    .where("rb.resume_id", "=", input.sourceResumeId)
    .where("rb.is_main", "=", true)
    .executeTakeFirst();

  if (!sourceBranch?.head_commit_id) {
    throw new ORPCError("BAD_REQUEST", { message: "Source resume has no commits" });
  }

  const sourceCommit = await db
    .selectFrom("resume_commits as rc")
    .select(["rc.id", "rc.tree_id"])
    .where("rc.id", "=", sourceBranch.head_commit_id)
    .executeTakeFirst();

  if (!sourceCommit?.tree_id) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Source commit has no tree" });
  }

  // Read source content so we can clone it
  const sourceContent = await readTreeContent(db, sourceCommit.tree_id);

  const targetTitle = input.name ?? sourceResume.title;

  const result = await db.transaction().execute(async (trx) => {
    // 1. Create new resume in target language
    const newResume = await trx
      .insertInto("resumes")
      .values({
        employee_id: sourceResume.employee_id,
        title: targetTitle,
        language: input.targetLanguage,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 2. Create main branch for new resume
    const newBranch = await trx
      .insertInto("resume_branches")
      .values({
        resume_id: newResume.id,
        name: "default",
        language: input.targetLanguage,
        is_main: true,
        head_commit_id: null,
        forked_from_commit_id: null,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 3. Build commit tree with cloned content (language updated to target)
    const clonedContent = { ...sourceContent, language: input.targetLanguage, title: targetTitle };
    const treeId = await buildCommitTree(trx, newResume.id, sourceResume.employee_id, clonedContent);

    // 4. Create root commit with cloned content
    const rootCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: newResume.id,
        tree_id: treeId,
        title: "initial (cloned from translation source)",
        description: "",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 5. Advance branch HEAD
    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: rootCommit.id })
      .where("id", "=", newBranch.id)
      .execute();

    // 6. Create CommitTag linking source head → new resume's root commit
    const tag = await trx
      .insertInto("commit_tags")
      .values({
        source_resume_id: input.sourceResumeId,
        target_resume_id: newResume.id,
        source_commit_id: sourceCommit.id,
        target_commit_id: rootCommit.id,
        kind: "translation",
        created_by: ownerEmployeeId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { resumeId: newResume.id, commitTagId: tag.id };
  });

  return result;
}

export const createTranslationResumeHandler = implement(contract.createTranslationResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createTranslationResume(getDb(), user, input);
  }
);

export function createCreateTranslationResumeHandler(db: Kysely<Database>) {
  return implement(contract.createTranslationResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createTranslationResume(db, user, input);
    }
  );
}
