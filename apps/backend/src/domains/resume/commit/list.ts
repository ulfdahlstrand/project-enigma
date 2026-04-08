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
 * Lists all commits reachable from a resume branch head in reverse chronological order.
 * Returns summaries (no content JSONB) — use getResumeCommit for full content.
 *
 * Access rules:
 *   - Admins can list commits reachable from any branch head.
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
    .select(["rb.id", "rb.resume_id", "rb.head_commit_id", "r.employee_id"])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (!branch.head_commit_id) {
    return [];
  }

  const rows = await db
    .selectFrom("resume_commits")
    .leftJoin("resume_commit_parents as rcp", (join) =>
      join
        .onRef("rcp.commit_id", "=", "resume_commits.id")
        .on("rcp.parent_order", "=", 0)
    )
    .select([
      "resume_commits.id",
      "resume_commits.resume_id",
      "rcp.parent_commit_id as parent_commit_id",
      "resume_commits.message",
      "resume_commits.title",
      "resume_commits.description",
      "resume_commits.created_by",
      "resume_commits.created_at",
    ])
    .where("resume_commits.resume_id", "=", branch.resume_id)
    .execute();

  const parentRows = await db
    .selectFrom("resume_commit_parents as rcp")
    .innerJoin("resume_commits as rc", "rc.id", "rcp.commit_id")
    .select([
      "rcp.commit_id",
      "rcp.parent_commit_id",
      "rcp.parent_order",
    ])
    .where("rc.resume_id", "=", branch.resume_id)
    .orderBy("rcp.commit_id", "asc")
    .orderBy("rcp.parent_order", "asc")
    .execute();

  const parentCommitIdsByCommitId = new Map<string, string[]>();
  parentRows.forEach((row) => {
    const existing = parentCommitIdsByCommitId.get(row.commit_id) ?? [];
    parentCommitIdsByCommitId.set(row.commit_id, [...existing, row.parent_commit_id]);
  });

  const reachableCommitIds = new Set<string>();
  const stack = [branch.head_commit_id];

  while (stack.length > 0) {
    const commitId = stack.pop()!;
    if (reachableCommitIds.has(commitId)) {
      continue;
    }

    reachableCommitIds.add(commitId);
    (parentCommitIdsByCommitId.get(commitId) ?? []).forEach((parentCommitId) => {
      if (!reachableCommitIds.has(parentCommitId)) {
        stack.push(parentCommitId);
      }
    });
  }

  const sortedRows = [...rows]
    .filter((row) => reachableCommitIds.has(row.id))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  return sortedRows.map((row) => ({
    id: row.id,
    resumeId: row.resume_id,
    parentCommitId: row.parent_commit_id,
    message: row.message,
    title: row.title,
    description: row.description,
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
