import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { readTreeContent } from "./read-tree-content.js";
import { buildCommitTree } from "./build-commit-tree.js";
import { listEducation } from "../../education/education/list.js";

interface UpsertBranchContentFromLiveParams {
  resumeId: string;
  branchId: string;
  userId: string | null;
  title?: string;
  consultantTitle?: string | null;
  presentation?: string[];
  summary?: string | null;
  highlightedItems?: string[];
  education?: ResumeCommitContent["education"];
  skillGroups?: Array<{ name: string; sortOrder: number }>;
  skills?: Array<{ name: string; category: string | null; sortOrder: number }>;
  assignments?: ResumeCommitContent["assignments"];
}

export async function upsertBranchContentFromLive(
  db: Kysely<Database>,
  params: UpsertBranchContentFromLiveParams,
): Promise<ResumeCommitContent> {
  const {
    resumeId,
    branchId,
    userId,
    title,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    education,
    skillGroups,
    skills,
    assignments,
  } = params;

  const branchRow = await db
    .selectFrom("resume_branches")
    .select(["id", "head_commit_id", "forked_from_commit_id"])
    .where("id", "=", branchId)
    .executeTakeFirstOrThrow();

  const [resumeRow, headCommitRow] = await Promise.all([
    db
      .selectFrom("resumes")
      .select(["employee_id", "title", "language"])
      .where("id", "=", resumeId)
      .executeTakeFirstOrThrow(),
    branchRow.head_commit_id ?? branchRow.forked_from_commit_id
      ? db
        .selectFrom("resume_commits")
        .select(["tree_id"])
        .where("id", "=", branchRow.head_commit_id ?? branchRow.forked_from_commit_id!)
        .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  const previousContent: ResumeCommitContent | undefined = headCommitRow?.tree_id
    ? await readTreeContent(db, headCommitRow.tree_id)
    : undefined;
  const liveEducation = await listEducation(db, resumeRow.employee_id);

  const content: ResumeCommitContent = {
    title: title !== undefined ? title : previousContent?.title ?? resumeRow.title,
    consultantTitle: consultantTitle !== undefined
      ? consultantTitle
      : previousContent?.consultantTitle ?? null,
    presentation: presentation !== undefined
      ? presentation
      : previousContent?.presentation ?? [],
    summary: summary !== undefined ? summary : previousContent?.summary ?? null,
    highlightedItems: highlightedItems !== undefined
      ? highlightedItems
      : previousContent?.highlightedItems ?? [],
    language: resumeRow.language,
    education: education !== undefined
      ? education
      : previousContent?.education?.length
        ? previousContent.education
        : liveEducation.map((row) => ({ type: row.type, value: row.value, sortOrder: row.sortOrder })),
    skillGroups: skillGroups !== undefined ? skillGroups : previousContent?.skillGroups ?? [],
    skills: skills !== undefined ? skills : previousContent?.skills ?? [],
    assignments: assignments !== undefined ? assignments : previousContent?.assignments ?? [],
  };

  const treeId = await buildCommitTree(
    db,
    resumeId,
    resumeRow.employee_id,
    content,
    headCommitRow?.tree_id ?? null,
  );

  if (branchRow.head_commit_id) {
    await db
      .updateTable("resume_commits")
      .set({ tree_id: treeId })
      .where("id", "=", branchRow.head_commit_id)
      .execute();
  } else {
    const newCommit = await db
      .insertInto("resume_commits")
      .values({
        resume_id: resumeId,
        tree_id: treeId,
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
