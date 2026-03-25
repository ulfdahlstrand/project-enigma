import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

/**
 * Syncs the branch_assignments table from a commit's JSONB content.
 * Upserts all assignments in the content into branch_assignments for the
 * given branch, preserving the branch_id + assignment_id uniqueness constraint.
 *
 * Call this after any operation that advances a branch's HEAD commit and
 * should be reflected in the live branch_assignments view.
 */
export async function syncBranchAssignmentsFromContent(
  db: Kysely<Database>,
  branchId: string,
  content: ResumeCommitContent
): Promise<void> {
  if (content.assignments.length === 0) return;

  await db
    .insertInto("branch_assignments")
    .values(
      content.assignments.map((a) => ({
        branch_id: branchId,
        assignment_id: a.assignmentId,
        client_name: a.clientName,
        role: a.role,
        description: a.description,
        start_date: new Date(a.startDate),
        end_date: a.endDate ? new Date(a.endDate) : null,
        technologies: a.technologies,
        is_current: a.isCurrent,
        keywords: a.keywords ?? null,
        type: a.type ?? null,
        highlight: a.highlight,
        sort_order: a.sortOrder ?? null,
      }))
    )
    .onConflict((oc) =>
      oc.columns(["branch_id", "assignment_id"]).doUpdateSet((eb) => ({
        client_name: eb.ref("excluded.client_name"),
        role: eb.ref("excluded.role"),
        description: eb.ref("excluded.description"),
        start_date: eb.ref("excluded.start_date"),
        end_date: eb.ref("excluded.end_date"),
        technologies: eb.ref("excluded.technologies"),
        is_current: eb.ref("excluded.is_current"),
        keywords: eb.ref("excluded.keywords"),
        type: eb.ref("excluded.type"),
        highlight: eb.ref("excluded.highlight"),
        sort_order: eb.ref("excluded.sort_order"),
        updated_at: new Date(),
      }))
    )
    .execute();
}
