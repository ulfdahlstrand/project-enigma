import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { forkResumeBranchInputSchema, forkResumeBranchOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// forkResumeBranch — query logic
// ---------------------------------------------------------------------------

type ForkResumeBranchInput = z.infer<typeof forkResumeBranchInputSchema>;
type ForkResumeBranchOutput = z.infer<typeof forkResumeBranchOutputSchema>;

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

  // Fetch commit + resume for ownership check; join source branch for language inheritance
  const commit = await db
    .selectFrom("resume_commits as rc")
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .leftJoin("resume_branches as src_rb", "src_rb.id", "rc.branch_id")
    .select([
      "rc.id",
      "rc.resume_id",
      "rc.branch_id as source_branch_id",
      "rc.content",
      "r.employee_id",
      "src_rb.language as source_language",
    ])
    .where("rc.id", "=", input.fromCommitId)
    .executeTakeFirst();

  if (commit === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && commit.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  // Create the new branch and copy assignments atomically.
  // No initial commit is created — the branch starts empty (headCommitId = null)
  // and the fork point is tracked via forkedFromCommitId.
  const newBranch = await db.transaction().execute(async (trx) => {
    const branch = await trx
      .insertInto("resume_branches")
      .values({
        resume_id: commit.resume_id,
        name: input.name,
        language: commit.source_language ?? "en",
        is_main: false,
        head_commit_id: null,
        forked_from_commit_id: input.fromCommitId,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Copy branch_assignments from the source branch (if any) — includes all content columns
    if (commit.source_branch_id !== null) {
      const sourceAssignments = await trx
        .selectFrom("branch_assignments as ba")
        .innerJoin("assignments as a", "a.id", "ba.assignment_id")
        .selectAll("ba")
        .where("ba.branch_id", "=", commit.source_branch_id)
        .where("a.deleted_at", "is", null)
        .execute();

      if (sourceAssignments.length > 0) {
        await trx
          .insertInto("branch_assignments")
          .values(
            sourceAssignments.map((a) => ({
              branch_id: branch.id,
              assignment_id: a.assignment_id,
              client_name: a.client_name,
              role: a.role,
              description: a.description,
              start_date: a.start_date,
              end_date: a.end_date,
              technologies: a.technologies,
              is_current: a.is_current,
              keywords: a.keywords,
              type: a.type,
              highlight: a.highlight,
              sort_order: a.sort_order,
            }))
          )
          .execute();
      }
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
