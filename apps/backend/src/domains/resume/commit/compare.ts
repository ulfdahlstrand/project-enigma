import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { diffResumeCommits } from "../lib/resume-diff.js";
import { readTreeContent } from "../lib/read-tree-content.js";
import {
  resumeCommitContentSchema,
} from "@cv-tool/contracts";
import type {
  compareResumeCommitsInputSchema,
  compareResumeCommitsOutputSchema,
} from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// compareResumeCommits — query logic
// ---------------------------------------------------------------------------

type CompareResumeCommitsInput = z.infer<typeof compareResumeCommitsInputSchema>;
type CompareResumeCommitsOutput = z.infer<typeof compareResumeCommitsOutputSchema>;

/**
 * Fetches two commits and returns their structural diff.
 *
 * Access rules:
 *   - Both commits must belong to the same resume (enforced implicitly via
 *     the resume's employee ownership check).
 *   - Admins can compare any commits.
 *   - Consultants can only compare commits on their own resumes.
 *
 * @throws ORPCError("NOT_FOUND")  if either commit does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 * @throws ORPCError("BAD_REQUEST") if the commits belong to different resumes.
 */
export async function compareResumeCommits(
  db: Kysely<Database>,
  user: AuthUser,
  input: CompareResumeCommitsInput
): Promise<CompareResumeCommitsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Fetch both commits in parallel
  const [baseRow, headRow] = await Promise.all([
    db
      .selectFrom("resume_commits as rc")
      .innerJoin("resumes as r", "r.id", "rc.resume_id")
      .select(["rc.id", "rc.resume_id", "rc.content", "rc.tree_id", "r.employee_id"])
      .where("rc.id", "=", input.baseCommitId)
      .executeTakeFirst(),
    db
      .selectFrom("resume_commits as rc")
      .innerJoin("resumes as r", "r.id", "rc.resume_id")
      .select(["rc.id", "rc.resume_id", "rc.content", "rc.tree_id", "r.employee_id"])
      .where("rc.id", "=", input.headCommitId)
      .executeTakeFirst(),
  ]);

  if (baseRow === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Base commit not found" });
  }
  if (headRow === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Head commit not found" });
  }

  if (baseRow.resume_id !== headRow.resume_id) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Commits must belong to the same resume",
    });
  }

  if (ownerEmployeeId !== null && baseRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const [baseContent, headContent] = await Promise.all([
    baseRow.tree_id
      ? readTreeContent(db, baseRow.tree_id)
      : resumeCommitContentSchema.parse(baseRow.content),
    headRow.tree_id
      ? readTreeContent(db, headRow.tree_id)
      : resumeCommitContentSchema.parse(headRow.content),
  ]);

  const diff = diffResumeCommits(baseContent, headContent);

  return {
    baseCommitId: input.baseCommitId,
    headCommitId: input.headCommitId,
    diff,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const compareResumeCommitsHandler = implement(
  contract.compareResumeCommits
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return compareResumeCommits(getDb(), user, input);
});

export function createCompareResumeCommitsHandler(db: Kysely<Database>) {
  return implement(contract.compareResumeCommits).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return compareResumeCommits(db, user, input);
    }
  );
}
