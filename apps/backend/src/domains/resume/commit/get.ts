import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { getResumeCommitInputSchema, getResumeCommitOutputSchema } from "@cv-tool/contracts";

function normaliseCommitContent(content: ResumeCommitContent): ResumeCommitContent {
  return {
    ...content,
    consultantTitle: content.consultantTitle ?? null,
    presentation: Array.isArray(content.presentation) ? content.presentation : [],
    summary: content.summary ?? null,
    highlightedItems: Array.isArray(content.highlightedItems) ? content.highlightedItems : [],
    skills: Array.isArray(content.skills) ? content.skills : [],
    assignments: Array.isArray(content.assignments)
      ? content.assignments.map((assignment) => ({
          ...assignment,
          endDate: assignment.endDate ?? null,
          technologies: Array.isArray(assignment.technologies) ? assignment.technologies : [],
          keywords: assignment.keywords ?? null,
          type: assignment.type ?? null,
          highlight: assignment.highlight ?? false,
          sortOrder: assignment.sortOrder ?? null,
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// getResumeCommit — query logic
// ---------------------------------------------------------------------------

type GetResumeCommitInput = z.infer<typeof getResumeCommitInputSchema>;
type GetResumeCommitOutput = z.infer<typeof getResumeCommitOutputSchema>;

/**
 * Fetches a single resume commit including its full content snapshot.
 *
 * Access rules:
 *   - Admins can fetch any commit.
 *   - Consultants can only fetch commits on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { commitId }
 * @throws ORPCError("NOT_FOUND")  if the commit does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 */
export async function getResumeCommit(
  db: Kysely<Database>,
  user: AuthUser,
  input: GetResumeCommitInput
): Promise<GetResumeCommitOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const row = await db
    .selectFrom("resume_commits as rc")
    .leftJoin("resume_commit_parents as rcp", (join) =>
      join
        .onRef("rcp.commit_id", "=", "rc.id")
        .on("rcp.parent_order", "=", 0)
    )
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .select([
      "rc.id",
      "rc.resume_id",
      "rc.branch_id",
      "rcp.parent_commit_id as parent_commit_id",
      "rc.content",
      "rc.message",
      "rc.created_by",
      "rc.created_at",
      "r.employee_id",
    ])
    .where("rc.id", "=", input.commitId)
    .executeTakeFirst();

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && row.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  return {
    id: row.id,
    resumeId: row.resume_id,
    branchId: row.branch_id,
    parentCommitId: row.parent_commit_id,
    content: normaliseCommitContent(row.content as unknown as ResumeCommitContent),
    message: row.message,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const getResumeCommitHandler = implement(contract.getResumeCommit).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getResumeCommit(getDb(), user, input);
  }
);

export function createGetResumeCommitHandler(db: Kysely<Database>) {
  return implement(contract.getResumeCommit).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResumeCommit(db, user, input);
    }
  );
}
