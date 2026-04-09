import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { readTreeContent } from "./read-tree-content.js";

const EMPTY_CONTENT = (
  title: string,
  language: string,
): ResumeCommitContent => ({
  title,
  consultantTitle: null,
  presentation: [],
  summary: null,
  highlightedItems: [],
  language,
  skillGroups: [],
  skills: [],
  assignments: [],
});

export async function filterDeletedAssignments(
  db: Kysely<Database>,
  assignments: ResumeCommitContent["assignments"],
): Promise<ResumeCommitContent["assignments"]> {
  if (assignments.length === 0) {
    return [];
  }

  const ids = [...new Set(assignments.map((assignment) => assignment.assignmentId))];
  const activeRows = await db
    .selectFrom("assignments")
    .select("id")
    .where("id", "in", ids)
    .where("deleted_at", "is", null)
    .execute();

  const activeIds = new Set(activeRows.map((row) => row.id));
  return assignments.filter((assignment) => activeIds.has(assignment.assignmentId));
}

export async function readBranchAssignmentContent(
  db: Kysely<Database>,
  branchId: string,
): Promise<{
  branchId: string;
  resumeId: string;
  employeeId: string;
  title: string;
  language: string;
  createdAt: Date;
  content: ResumeCommitContent;
} | null> {
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
      "rb.created_at",
      "r.employee_id",
      "r.title",
      "r.language",
    ])
    .where("rb.id", "=", branchId)
    .executeTakeFirst();

  if (!branch) {
    return null;
  }

  const snapshotCommitId = branch.head_commit_id ?? branch.forked_from_commit_id ?? null;
  const commit = snapshotCommitId
    ? await db
        .selectFrom("resume_commits")
        .select(["tree_id"])
        .where("id", "=", snapshotCommitId)
        .executeTakeFirst()
    : null;

  const content = commit?.tree_id
    ? await readTreeContent(db, commit.tree_id)
    : EMPTY_CONTENT(branch.title, branch.language);

  return {
    branchId: branch.id,
    resumeId: branch.resume_id,
    employeeId: branch.employee_id,
    title: branch.title,
    language: branch.language,
    createdAt: branch.created_at,
    content: {
      ...content,
      assignments: await filterDeletedAssignments(db, content.assignments ?? []),
    },
  };
}
