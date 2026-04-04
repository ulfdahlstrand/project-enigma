import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { getResumeOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// getResume — query logic
// ---------------------------------------------------------------------------

type GetResumeOutput = z.infer<typeof getResumeOutputSchema>;

/**
 * Fetches a single resume with its skills by ID.
 *
 * Access rules:
 *   - Admins can fetch any resume.
 *   - Consultants can only fetch resumes belonging to their employee record;
 *     throws FORBIDDEN if the resume belongs to a different employee.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the resume to retrieve.
 * @throws ORPCError("NOT_FOUND")  if the resume does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to access another's resume.
 */
export async function getResume(
  db: Kysely<Database>,
  user: AuthUser,
  id: string,
  branchId?: string,
): Promise<GetResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resumeRow = await db
    .selectFrom("resumes as r")
    .leftJoin("resume_branches as rb", (join) =>
      join.onRef("rb.resume_id", "=", "r.id").on("rb.is_main", "=", true)
    )
    .select([
      "r.id",
      "r.employee_id",
      "r.title",
      "r.consultant_title",
      "r.presentation",
      "r.summary",
      "r.language",
      "r.is_main",
      "r.created_at",
      "r.updated_at",
      "rb.id as branch_id",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
    ])
    .where("r.id", "=", id)
    .executeTakeFirst();

  if (resumeRow === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && resumeRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  let snapshotContent: ResumeCommitContent | null = null;
  if (branchId) {
    const branchRow = await db
      .selectFrom("resume_branches")
      .select(["id", "resume_id", "head_commit_id", "forked_from_commit_id"])
      .where("id", "=", branchId)
      .executeTakeFirst();

    if (branchRow === undefined || branchRow.resume_id !== id) {
      throw new ORPCError("NOT_FOUND");
    }

    const snapshotCommitId = branchRow.head_commit_id ?? branchRow.forked_from_commit_id;
    if (snapshotCommitId) {
      const commitRow = await db
        .selectFrom("resume_commits")
        .select("content")
        .where("id", "=", snapshotCommitId)
        .executeTakeFirst();
      snapshotContent = commitRow?.content ?? null;
    }
  } else if (resumeRow.head_commit_id) {
    const commitRow = await db
      .selectFrom("resume_commits")
      .select("content")
      .where("id", "=", resumeRow.head_commit_id)
      .executeTakeFirst();
    snapshotContent = commitRow?.content ?? null;
  }

  const skillRows = await db
    .selectFrom("resume_skills")
    .selectAll()
    .where("cv_id", "=", id)
    .orderBy("sort_order", "asc")
    .execute();

  const highlightedItemRows = await db
    .selectFrom("resume_highlighted_items")
    .select(["text"])
    .where("resume_id", "=", id)
    .orderBy("sort_order", "asc")
    .execute();

  return {
    id: resumeRow.id,
    employeeId: resumeRow.employee_id,
    title: snapshotContent?.title ?? resumeRow.title,
    consultantTitle: snapshotContent?.consultantTitle ?? resumeRow.consultant_title,
    presentation: snapshotContent?.presentation ?? resumeRow.presentation ?? [],
    summary: snapshotContent?.summary ?? resumeRow.summary,
    highlightedItems: snapshotContent?.highlightedItems ?? highlightedItemRows.map((item) => item.text),
    language: snapshotContent?.language ?? resumeRow.language,
    isMain: resumeRow.is_main,
    mainBranchId: resumeRow.branch_id ?? null,
    headCommitId: resumeRow.head_commit_id ?? null,
    createdAt: resumeRow.created_at,
    updatedAt: resumeRow.updated_at,
    skills: skillRows.map((s) => ({
      id: s.id,
      cvId: s.cv_id,
      name: s.name,
      level: s.level,
      category: s.category,
      sortOrder: s.sort_order,
    })),
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const getResumeHandler = implement(contract.getResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getResume(getDb(), user, input.id, input.branchId);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `getResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createGetResumeHandler(db: Kysely<Database>) {
  return implement(contract.getResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResume(db, user, input.id, input.branchId);
    }
  );
}
