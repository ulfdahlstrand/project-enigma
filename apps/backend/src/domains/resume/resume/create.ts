import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { buildCommitTree } from "../lib/build-commit-tree.js";
import type { createResumeInputSchema, createResumeOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// createResume — query logic
// ---------------------------------------------------------------------------

type CreateResumeInput = z.infer<typeof createResumeInputSchema>;
type CreateResumeOutput = z.infer<typeof createResumeOutputSchema>;

/**
 * Creates a new resume with an initial main branch and empty root commit,
 * all within a single transaction.
 *
 * Access rules:
 *   - Admins can create resumes for any employee.
 *   - Consultants can only create resumes for their own employee record;
 *     throws FORBIDDEN if the input employeeId does not match their own.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Resume creation parameters.
 * @throws ORPCError("FORBIDDEN") if a consultant tries to create a resume for another employee.
 */
export async function createResume(
  db: Kysely<Database>,
  user: AuthUser,
  input: CreateResumeInput
): Promise<CreateResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Consultants may only create resumes for their own employee record
  if (ownerEmployeeId !== null && input.employeeId !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const language = input.language ?? "en";

  const { resume, branch } = await db.transaction().execute(async (trx) => {
    // 1. Insert the resume
    const newResume = await trx
      .insertInto("resumes")
      .values({
        employee_id: input.employeeId,
        title: input.title,
        language,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 2. Create the main branch
    const newBranch = await trx
      .insertInto("resume_branches")
      .values({
        resume_id: newResume.id,
        name: "main",
        language,
        is_main: true,
        head_commit_id: null,
        forked_from_commit_id: null,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 3. Create the root commit (empty snapshot)
    const initialContent: ResumeCommitContent = {
      title: newResume.title,
      consultantTitle: null,
      presentation: [],
      summary: input.summary ?? null,
      highlightedItems: [],
      language,
      education: [],
      skillGroups: [],
      skills: [],
      assignments: [],
    };

    const treeId = await buildCommitTree(trx, newResume.id, input.employeeId, initialContent);

    const rootCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: newResume.id,
        tree_id: treeId,
        message: "initial",
        title: "initial",
        description: "",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 4. Advance branch HEAD to the root commit
    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: rootCommit.id })
      .where("id", "=", newBranch.id)
      .execute();

    return { resume: newResume, branch: { ...newBranch, head_commit_id: rootCommit.id } };
  });

  return {
    id: resume.id,
    employeeId: resume.employee_id,
    title: resume.title,
    consultantTitle: null,
    presentation: [],
    summary: input.summary ?? null,
    highlightedItems: [],
    language: resume.language,
    isMain: resume.is_main,
    mainBranchId: branch.id,
    headCommitId: branch.head_commit_id,
    createdAt: resume.created_at,
    updatedAt: resume.updated_at,
    education: [],
    skillGroups: [],
    skills: [],
    assignments: [],
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const createResumeHandler = implement(contract.createResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return createResume(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `createResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createCreateResumeHandler(db: Kysely<Database>) {
  return implement(contract.createResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createResume(db, user, input);
    }
  );
}
