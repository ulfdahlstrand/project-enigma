import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { forkResumeBranchInputSchema, forkResumeBranchOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// forkResumeBranch — query logic
// ---------------------------------------------------------------------------

type ForkResumeBranchInput = z.infer<typeof forkResumeBranchInputSchema>;
type ForkResumeBranchOutput = z.infer<typeof forkResumeBranchOutputSchema>;

function normaliseRevisionBranchName(name: string): string {
  const trimmed = name.trim();
  const isRevisionBranch =
    /^AI revision:\s*/i.test(trimmed) ||
    /^revision\//i.test(trimmed);

  if (!isRevisionBranch) {
    return trimmed;
  }

  const slug = trimmed
    .replace(/^AI revision:\s*/i, "")
    .replace(/^revision\//i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug ? `revision/${slug}` : "revision/untitled";
}

/**
 * Creates a new branch forked from a specific commit.
 *
 * The new branch's HEAD starts at the forked commit (inheriting its full
 * resume snapshot), and its branch_assignments are copied from the source
 * branch so the user starts with the same assignment curation.
 *
 * Access rules:
 *   - Admins can fork any branch.
 *   - Consultants can only fork branches on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { fromCommitId, name }
 * @throws ORPCError("NOT_FOUND")  if the commit does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 */
export async function forkResumeBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: ForkResumeBranchInput
): Promise<ForkResumeBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Fetch commit + resume for ownership check.
  const commit = await db
    .selectFrom("resume_commits as rc")
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .select([
      "rc.id",
      "rc.resume_id",
      "rc.content",
      "r.employee_id",
    ])
    .where("rc.id", "=", input.fromCommitId)
    .executeTakeFirst();

  if (commit === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && commit.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const commitContent = commit.content as ResumeCommitContent;

  // Create the new branch and copy assignments atomically.
  // No initial commit is created — the branch starts empty (headCommitId = null)
  // and the fork point is tracked via forkedFromCommitId.
  const newBranch = await db.transaction().execute(async (trx) => {
    const branch = await trx
      .insertInto("resume_branches")
      .values({
        resume_id: commit.resume_id,
        name: normaliseRevisionBranchName(input.name),
        language: commitContent.language ?? "en",
        is_main: false,
        head_commit_id: null,
        forked_from_commit_id: input.fromCommitId,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Copy branch assignments from the forked commit snapshot so forking works
    // even when the source branch has been deleted.
    if (commitContent.assignments.length > 0) {
      await trx
        .insertInto("branch_assignments")
        .values(
          commitContent.assignments.map((assignment) => ({
            branch_id: branch.id,
            assignment_id: assignment.assignmentId,
            client_name: assignment.clientName,
            role: assignment.role,
            description: assignment.description,
            start_date: new Date(assignment.startDate),
            end_date: assignment.endDate ? new Date(assignment.endDate) : null,
            technologies: assignment.technologies,
            is_current: assignment.isCurrent,
            keywords: assignment.keywords,
            type: assignment.type,
            highlight: assignment.highlight,
            sort_order: assignment.sortOrder,
          }))
        )
        .execute();
    }

    return branch;
  });

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
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const forkResumeBranchHandler = implement(contract.forkResumeBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return forkResumeBranch(getDb(), user, input);
  }
);

export function createForkResumeBranchHandler(db: Kysely<Database>) {
  return implement(contract.forkResumeBranch).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return forkResumeBranch(db, user, input);
    }
  );
}
