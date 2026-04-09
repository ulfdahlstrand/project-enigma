import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

/**
 * Builds an immutable commit tree for the given content and returns the tree_id.
 *
 * Called inside the saveResumeVersion transaction. Creates:
 *   - One resume_tree row
 *   - One resume_tree_entry per content type (metadata, summary, assignments, …)
 *   - One revision row per entry (in the appropriate revision table)
 *   - One resume_tree_entry_content row linking each entry to its revision
 *
 * The tree_id is then stored on the resume_commit row, replacing the legacy
 * content JSON as the canonical source of truth (Phase 3 onwards).
 *
 * @param trx        - Kysely transaction instance.
 * @param resumeId   - ID of the resume this commit belongs to.
 * @param employeeId - ID of the employee who owns the resume (needed for education snapshot).
 * @param content    - The full content object being committed.
 */
export async function buildCommitTree(
  trx: Kysely<Database>,
  resumeId: string,
  employeeId: string,
  content: ResumeCommitContent,
): Promise<string> {
  const { id: treeId } = await trx
    .insertInto("resume_trees")
    .values({ created_at: new Date() })
    .returning("id")
    .executeTakeFirstOrThrow();

  let position = 0;

  const addEntry = async (
    entryType: string,
    revisionType: string,
    revisionId: string,
  ) => {
    const { id: entryId } = await trx
      .insertInto("resume_tree_entries")
      .values({ tree_id: treeId, entry_type: entryType, position })
      .returning("id")
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("resume_tree_entry_content")
      .values({ entry_id: entryId, revision_id: revisionId, revision_type: revisionType })
      .execute();

    position += 1;
  };

  // ── metadata ──────────────────────────────────────────────────────────────
  const { id: metadataRevId } = await trx
    .insertInto("resume_revision_metadata")
    .values({ title: content.title, language: content.language })
    .returning("id")
    .executeTakeFirstOrThrow();
  await addEntry("metadata", "resume_revision_metadata", metadataRevId);

  // ── consultant_title ──────────────────────────────────────────────────────
  if (content.consultantTitle !== null && content.consultantTitle !== undefined) {
    const { id: ctRevId } = await trx
      .insertInto("resume_revision_consultant_title")
      .values({ value: content.consultantTitle })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("consultant_title", "resume_revision_consultant_title", ctRevId);
  }

  // ── presentation ──────────────────────────────────────────────────────────
  const { id: presentationRevId } = await trx
    .insertInto("resume_revision_presentation")
    .values({ paragraphs: content.presentation ?? [] })
    .returning("id")
    .executeTakeFirstOrThrow();
  await addEntry("presentation", "resume_revision_presentation", presentationRevId);

  // ── summary ───────────────────────────────────────────────────────────────
  if (content.summary !== null && content.summary !== undefined) {
    const { id: summaryRevId } = await trx
      .insertInto("resume_revision_summary")
      .values({ content: content.summary })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("summary", "resume_revision_summary", summaryRevId);
  }

  // ── highlighted_items ─────────────────────────────────────────────────────
  const { id: highlightedRevId } = await trx
    .insertInto("resume_revision_highlighted_item")
    .values({ items: content.highlightedItems ?? [] })
    .returning("id")
    .executeTakeFirstOrThrow();
  await addEntry("highlighted_items", "resume_revision_highlighted_item", highlightedRevId);

  // ── skill_groups ──────────────────────────────────────────────────────────
  // Track inserted group revision IDs by name for use in the skills loop below.
  const groupRevIdByName = new Map<string, string>();
  for (const group of content.skillGroups) {
    const { id: groupRevId } = await trx
      .insertInto("resume_revision_skill_group")
      .values({ name: group.name, sort_order: group.sortOrder })
      .returning("id")
      .executeTakeFirstOrThrow();
    groupRevIdByName.set(group.name, groupRevId);
    await addEntry("skill_group", "resume_revision_skill_group", groupRevId);
  }

  // ── skills ────────────────────────────────────────────────────────────────
  for (const skill of content.skills) {
    const groupRevId =
      groupRevIdByName.get(skill.category?.trim() ?? "") ??
      [...groupRevIdByName.values()][0] ??
      "00000000-0000-0000-0000-000000000000";

    const { id: skillRevId } = await trx
      .insertInto("resume_revision_skill")
      .values({ name: skill.name, group_revision_id: groupRevId, sort_order: skill.sortOrder })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("skill", "resume_revision_skill", skillRevId);
  }

  // ── assignments ───────────────────────────────────────────────────────────
  for (const assignment of content.assignments) {
    const startDate = assignment.startDate
      ? new Date(assignment.startDate)
      : new Date();
    const endDate = assignment.endDate ? new Date(assignment.endDate) : null;

    const { id: assignmentRevId } = await trx
      .insertInto("resume_revision_assignment")
      .values({
        assignment_id: assignment.assignmentId,
        client_name: assignment.clientName,
        role: assignment.role,
        description: assignment.description,
        technologies: assignment.technologies,
        start_date: startDate,
        end_date: endDate,
        is_current: assignment.isCurrent,
        sort_order: assignment.sortOrder,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("assignment", "resume_revision_assignment", assignmentRevId);
  }

  // ── education (snapshot from employee record) ─────────────────────────────
  for (const edu of content.education ?? []) {
    const { id: eduRevId } = await trx
      .insertInto("resume_revision_education")
      .values({
        employee_id: employeeId,
        type: edu.type,
        value: edu.value,
        sort_order: edu.sortOrder,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("education", "resume_revision_education", eduRevId);
  }

  return treeId;
}
