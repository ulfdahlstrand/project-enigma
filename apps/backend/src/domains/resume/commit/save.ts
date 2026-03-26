import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { saveResumeVersionInputSchema, saveResumeVersionOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// saveResumeVersion — query logic
// ---------------------------------------------------------------------------

type SaveResumeVersionInput = z.infer<typeof saveResumeVersionInputSchema>;
type SaveResumeVersionOutput = z.infer<typeof saveResumeVersionOutputSchema>;

/**
 * Creates an immutable snapshot (commit) of the current state of a resume
 * branch. Advances the branch's head_commit_id to the new commit.
 *
 * The snapshot captures: resume scalar fields, skills, and all assignments
 * currently linked to the branch via branch_assignments.
 *
 * Access rules:
 *   - Admins can save any branch.
 *   - Consultants can only save branches on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { branchId, message? }
 * @throws ORPCError("NOT_FOUND")  if the branch does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 */
export async function saveResumeVersion(
  db: Kysely<Database>,
  user: AuthUser,
  input: SaveResumeVersionInput
): Promise<SaveResumeVersionOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Fetch branch + resume in one query to check ownership and get current head
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.head_commit_id",
      "r.employee_id",
      "r.title",
      "r.consultant_title",
      "r.presentation",
      "r.summary",
      "r.language",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  // Fetch skills for this resume
  const skillRows = await db
    .selectFrom("resume_skills")
    .select(["name", "level", "category", "sort_order"])
    .where("cv_id", "=", branch.resume_id)
    .orderBy("sort_order", "asc")
    .execute();

  // Fetch assignments linked to this branch — all content is now in branch_assignments.
  // Soft-deleted assignments are excluded (deleted_at IS NULL guard).
  const assignmentRows = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("assignments as a", "a.id", "ba.assignment_id")
    .select([
      "ba.assignment_id",
      "ba.client_name",
      "ba.role",
      "ba.description",
      "ba.start_date",
      "ba.end_date",
      "ba.technologies",
      "ba.is_current",
      "ba.keywords",
      "ba.type",
      "ba.highlight",
      "ba.sort_order",
    ])
    .where("ba.branch_id", "=", input.branchId)
    .where("a.deleted_at", "is", null)
    .orderBy("ba.sort_order", "asc")
    .execute();

  const content: ResumeCommitContent = {
    title: branch.title,
    consultantTitle: "consultantTitle" in input ? input.consultantTitle ?? null : branch.consultant_title,
    presentation: input.presentation ?? branch.presentation ?? [],
    summary: "summary" in input ? input.summary ?? null : branch.summary,
    language: branch.language,
    skills: skillRows.map((s) => ({
      name: s.name,
      level: s.level,
      category: s.category,
      sortOrder: s.sort_order,
    })),
    assignments: assignmentRows.map((a) => ({
      assignmentId: a.assignment_id,
      clientName: a.client_name,
      role: a.role,
      description: a.description,
      startDate: a.start_date instanceof Date ? a.start_date.toISOString() : String(a.start_date),
      endDate: a.end_date instanceof Date ? a.end_date.toISOString() : (a.end_date ? String(a.end_date) : null),
      technologies: a.technologies ?? [],
      isCurrent: a.is_current,
      keywords: a.keywords,
      type: a.type,
      highlight: a.highlight,
      sortOrder: a.sort_order,
    })),
  };

  // Atomically insert commit and update branch HEAD
  const commit = await db.transaction().execute(async (trx) => {
    const newCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: branch.resume_id,
        branch_id: input.branchId,
        content: JSON.stringify(content),
        message: input.message ?? "",
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (branch.head_commit_id !== null) {
      await trx
        .insertInto("resume_commit_parents")
        .values({
          commit_id: newCommit.id,
          parent_commit_id: branch.head_commit_id,
          parent_order: 0,
        })
        .execute();
    }

    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: newCommit.id })
      .where("id", "=", input.branchId)
      .execute();

    return newCommit;
  });

  return {
    id: commit.id,
    resumeId: commit.resume_id,
    branchId: commit.branch_id,
    parentCommitId: branch.head_commit_id,
    content: commit.content as unknown as ResumeCommitContent,
    message: commit.message,
    createdBy: commit.created_by,
    createdAt: commit.created_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const saveResumeVersionHandler = implement(contract.saveResumeVersion).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return saveResumeVersion(getDb(), user, input);
  }
);

export function createSaveResumeVersionHandler(db: Kysely<Database>) {
  return implement(contract.saveResumeVersion).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return saveResumeVersion(db, user, input);
    }
  );
}
