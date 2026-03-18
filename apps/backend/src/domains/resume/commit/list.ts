import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { listResumeCommitsInputSchema, listResumeCommitsOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// listResumeCommits — query logic
// ---------------------------------------------------------------------------

type ListResumeCommitsInput = z.infer<typeof listResumeCommitsInputSchema>;
type ListResumeCommitsOutput = z.infer<typeof listResumeCommitsOutputSchema>;

/**
 * Lists all commits for a resume branch in reverse chronological order.
 * Returns summaries (no content JSONB) — use getResumeCommit for full content.
 *
 * Access rules:
 *   - Admins can list commits for any branch.
 *   - Consultants can only list commits on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { branchId }
 * @throws ORPCError("NOT_FOUND")  if the branch does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 */
export async function listResumeCommits(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListResumeCommitsInput
): Promise<ListResumeCommitsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify the branch exists and check ownership
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["rb.id", "r.employee_id"])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const rows = await db
    .selectFrom("resume_commits")
    .select([
      "id",
      "resume_id",
      "branch_id",
      "parent_commit_id",
      "message",
      "created_by",
      "created_at",
    ])
    .where("branch_id", "=", input.branchId)
    .orderBy("created_at", "desc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
    resumeId: row.resume_id,
    branchId: row.branch_id,
    parentCommitId: row.parent_commit_id,
    message: row.message,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const listResumeCommitsHandler = implement(contract.listResumeCommits).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listResumeCommits(getDb(), user, input);
  }
);

export function createListResumeCommitsHandler(db: Kysely<Database>) {
  return implement(contract.listResumeCommits).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listResumeCommits(db, user, input);
    }
  );
}
