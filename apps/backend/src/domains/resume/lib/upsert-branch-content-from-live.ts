import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

interface UpsertBranchContentFromLiveParams {
  resumeId: string;
  branchId: string;
  userId: string | null;
  consultantTitle?: string | null;
  presentation?: string[];
}

export async function upsertBranchContentFromLive(
  db: Kysely<Database>,
  params: UpsertBranchContentFromLiveParams,
): Promise<ResumeCommitContent> {
  const { resumeId, branchId, userId, consultantTitle, presentation } = params;

  const branchRow = await db
    .selectFrom("resume_branches")
    .select(["id", "head_commit_id"])
    .where("id", "=", branchId)
    .executeTakeFirstOrThrow();

  const [resumeRow, skillGroups, skillRows, assignmentRows, highlightedItemRows, headCommitRow] =
    await Promise.all([
      db
        .selectFrom("resumes")
        .select(["title", "summary", "language"])
        .where("id", "=", resumeId)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("resume_skill_groups")
        .select(["name", "sort_order"])
        .where("resume_id", "=", resumeId)
        .orderBy("sort_order", "asc")
        .execute(),
      db
        .selectFrom("resume_skills as rs")
        .innerJoin("resume_skill_groups as rsg", "rsg.id", "rs.group_id")
        .select(["rs.name", "rs.sort_order", "rsg.name as category"])
        .where("rs.resume_id", "=", resumeId)
        .orderBy("rsg.sort_order", "asc")
        .orderBy("rs.sort_order", "asc")
        .execute(),
      db
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
        .where("ba.branch_id", "=", branchId)
        .where("a.deleted_at", "is", null)
        .orderBy("ba.sort_order", "asc")
        .execute(),
      db
        .selectFrom("resume_highlighted_items")
        .select(["text"])
        .where("resume_id", "=", resumeId)
        .orderBy("sort_order", "asc")
        .execute(),
      branchRow.head_commit_id
        ? db
          .selectFrom("resume_commits")
          .select(["content"])
          .where("id", "=", branchRow.head_commit_id)
          .executeTakeFirst()
        : Promise.resolve(undefined),
    ]);

  const previousContent = headCommitRow?.content as ResumeCommitContent | undefined;

  const content: ResumeCommitContent = {
    title: resumeRow.title,
    consultantTitle: consultantTitle !== undefined
      ? consultantTitle
      : previousContent?.consultantTitle ?? null,
    presentation: presentation !== undefined
      ? presentation
      : previousContent?.presentation ?? [],
    summary: resumeRow.summary,
    highlightedItems: highlightedItemRows.map((item) => item.text),
    language: resumeRow.language,
    skillGroups: skillGroups.map((group) => ({
      name: group.name,
      sortOrder: group.sort_order,
    })),
    skills: skillRows.map((skill) => ({
      name: skill.name,
      category: skill.category,
      sortOrder: skill.sort_order,
    })),
    assignments: assignmentRows.map((assignment) => ({
      assignmentId: assignment.assignment_id,
      clientName: assignment.client_name,
      role: assignment.role,
      description: assignment.description,
      startDate: assignment.start_date instanceof Date
        ? assignment.start_date.toISOString()
        : String(assignment.start_date),
      endDate: assignment.end_date instanceof Date
        ? assignment.end_date.toISOString()
        : (assignment.end_date ? String(assignment.end_date) : null),
      technologies: assignment.technologies ?? [],
      isCurrent: assignment.is_current,
      keywords: assignment.keywords,
      type: assignment.type,
      highlight: assignment.highlight,
      sortOrder: assignment.sort_order,
    })),
  };

  if (branchRow.head_commit_id) {
    await db
      .updateTable("resume_commits")
      .set({ content: JSON.stringify(content) })
      .where("id", "=", branchRow.head_commit_id)
      .execute();
  } else {
    const newCommit = await db
      .insertInto("resume_commits")
      .values({
        resume_id: resumeId,
        branch_id: branchId,
        content: JSON.stringify(content),
        message: "initial",
        title: "initial",
        description: "",
        created_by: userId,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await db
      .updateTable("resume_branches")
      .set({ head_commit_id: newCommit.id })
      .where("id", "=", branchId)
      .execute();
  }

  return content;
}
