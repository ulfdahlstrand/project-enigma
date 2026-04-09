import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { readTreeContent } from "./read-tree-content.js";
import { buildCommitTree } from "./build-commit-tree.js";

interface UpsertBranchContentFromLiveParams {
  resumeId: string;
  branchId: string;
  userId: string | null;
  consultantTitle?: string | null;
  presentation?: string[];
  highlightedItems?: string[];
  skillGroups?: Array<{ name: string; sortOrder: number }>;
  skills?: Array<{ name: string; category: string | null; sortOrder: number }>;
}

export async function upsertBranchContentFromLive(
  db: Kysely<Database>,
  params: UpsertBranchContentFromLiveParams,
): Promise<ResumeCommitContent> {
  const { resumeId, branchId, userId, consultantTitle, presentation, highlightedItems, skillGroups, skills } = params;

  const branchRow = await db
    .selectFrom("resume_branches")
    .select(["id", "head_commit_id"])
    .where("id", "=", branchId)
    .executeTakeFirstOrThrow();

  const [resumeRow, headCommitRow] = await Promise.all([
    db
      .selectFrom("resumes")
      .select(["employee_id", "title", "summary", "language"])
      .where("id", "=", resumeId)
      .executeTakeFirstOrThrow(),
    branchRow.head_commit_id
      ? db
        .selectFrom("resume_commits")
        .select(["tree_id"])
        .where("id", "=", branchRow.head_commit_id)
        .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  const previousContent: ResumeCommitContent | undefined = headCommitRow?.tree_id
    ? await readTreeContent(db, headCommitRow.tree_id)
    : undefined;

  const content: ResumeCommitContent = {
    title: resumeRow.title,
    consultantTitle: consultantTitle !== undefined
      ? consultantTitle
      : previousContent?.consultantTitle ?? null,
    presentation: presentation !== undefined
      ? presentation
      : previousContent?.presentation ?? [],
    summary: resumeRow.summary,
    highlightedItems: highlightedItems !== undefined
      ? highlightedItems
      : previousContent?.highlightedItems ?? [],
    language: resumeRow.language,
    skillGroups: skillGroups !== undefined ? skillGroups : previousContent?.skillGroups ?? [],
    skills: skills !== undefined ? skills : previousContent?.skills ?? [],
    assignments: previousContent?.assignments ?? [],
  };

  const treeId = await buildCommitTree(db, resumeId, resumeRow.employee_id, content);

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
