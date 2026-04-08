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

function equalsByJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function joinNaturalLanguage(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function summarizeCommitChanges(
  baseContent: ResumeCommitContent,
  nextContent: ResumeCommitContent
): { title: string; description: string } {
  const changedAreas: string[] = [];

  if (!equalsByJson(baseContent.consultantTitle, nextContent.consultantTitle)) {
    changedAreas.push("consultant title");
  }
  if (!equalsByJson(baseContent.presentation, nextContent.presentation)) {
    changedAreas.push("presentation");
  }
  if (!equalsByJson(baseContent.summary, nextContent.summary)) {
    changedAreas.push("summary");
  }
  if (!equalsByJson(baseContent.highlightedItems, nextContent.highlightedItems)) {
    changedAreas.push("highlights");
  }
  if (
    !equalsByJson(baseContent.skillGroups, nextContent.skillGroups)
    || !equalsByJson(baseContent.skills, nextContent.skills)
  ) {
    changedAreas.push("skills");
  }
  if (!equalsByJson(baseContent.assignments, nextContent.assignments)) {
    changedAreas.push("assignments");
  }

  if (changedAreas.length === 0) {
    return {
      title: "Save resume version",
      description: "Saved the current resume snapshot without content changes.",
    };
  }

  const areaList = joinNaturalLanguage(changedAreas);

  return {
    title: `Update ${areaList}`,
    description: `Updated ${areaList}.`,
  };
}

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

  const headCommit = branch.head_commit_id
    ? await db
        .selectFrom("resume_commits")
        .select(["content"])
        .where("id", "=", branch.head_commit_id)
        .executeTakeFirst()
    : null;

  const baseContent = (headCommit?.content as ResumeCommitContent | undefined) ?? {
      title: branch.title,
      consultantTitle: null,
      presentation: [],
      summary: branch.summary,
      highlightedItems: [],
      language: branch.language,
      skillGroups: [],
      skills: [],
      assignments: [],
  };

  const shouldReadLegacySkills =
    headCommit === null && (input.skillGroups === undefined || input.skills === undefined);

  const skillGroups = shouldReadLegacySkills
    ? await db
        .selectFrom("resume_skill_groups")
        .select(["id", "name", "sort_order"])
        .where("resume_id", "=", branch.resume_id)
        .orderBy("sort_order", "asc")
        .execute()
    : [];

  const skillRows = shouldReadLegacySkills
    ? await db
        .selectFrom("resume_skills as rs")
        .innerJoin("resume_skill_groups as rsg", "rsg.id", "rs.group_id")
        .select([
          "rs.name",
          "rs.sort_order",
          "rs.group_id",
          "rsg.name as category",
        ])
        .where("rs.resume_id", "=", branch.resume_id)
        .orderBy("rsg.sort_order", "asc")
        .orderBy("rs.sort_order", "asc")
        .execute()
    : [];

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
    title: baseContent.title,
    consultantTitle: "consultantTitle" in input ? input.consultantTitle ?? null : baseContent.consultantTitle,
    presentation: input.presentation ?? baseContent.presentation ?? [],
    summary: "summary" in input ? input.summary ?? null : baseContent.summary,
    highlightedItems: input.highlightedItems ?? baseContent.highlightedItems ?? [],
    language: baseContent.language,
    skillGroups: input.skillGroups
      ?? (headCommit
        ? baseContent.skillGroups ?? []
        : skillGroups.map((group) => ({
            name: group.name,
            sortOrder: group.sort_order,
          }))),
    skills: (input.skills
      ?? (headCommit
        ? baseContent.skills ?? []
        : skillRows.map((s) => ({
            name: s.name,
            category: s.category,
            sortOrder: s.sort_order,
          })))).map((skill) => ({
      name: skill.name,
      category: skill.category,
      sortOrder: skill.sortOrder,
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

  const generatedMetadata = summarizeCommitChanges(baseContent, content);
  const title = input.title?.trim() || input.message?.trim() || generatedMetadata.title;
  const description = input.description?.trim() || generatedMetadata.description;
  const message = input.message?.trim() || title;

  // Atomically insert commit and update branch HEAD
  const commit = await db.transaction().execute(async (trx) => {
    const newCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: branch.resume_id,
        branch_id: input.branchId,
        content: JSON.stringify(content),
        title,
        description,
        message,
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
    title: commit.title,
    description: commit.description,
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
