import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { readTreeContent } from "./read-tree-content.js";

function equalsByJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function loadRevisionIdsByEntryType(
  trx: Kysely<Database>,
  treeId: string,
): Promise<Record<string, string[]>> {
  const rows = await trx
    .selectFrom("resume_tree_entries as rte")
    .innerJoin("resume_tree_entry_content as rtec", "rtec.entry_id", "rte.id")
    .select([
      "rte.entry_type as entryType",
      "rtec.revision_id as revisionId",
      "rte.position as position",
    ])
    .where("rte.tree_id", "=", treeId)
    .orderBy("rte.position", "asc")
    .execute();

  return rows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.entryType] ??= [];
    acc[row.entryType]!.push(row.revisionId);
    return acc;
  }, {});
}

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
  baseTreeId: string | null = null,
): Promise<string> {
  const [baseContent, baseRevisionIds] = baseTreeId
    ? await Promise.all([
        readTreeContent(trx, baseTreeId),
        loadRevisionIdsByEntryType(trx, baseTreeId),
      ])
    : [null, {} as Record<string, string[]>];

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
  const metadataRevId = baseContent !== null
    && equalsByJson(
      { title: baseContent.title, language: baseContent.language },
      { title: content.title, language: content.language },
    )
    && baseRevisionIds["metadata"]?.[0]
    ? baseRevisionIds["metadata"][0]
    : (await trx
        .insertInto("resume_revision_metadata")
        .values({ title: content.title, language: content.language })
        .returning("id")
        .executeTakeFirstOrThrow()).id;
  await addEntry("metadata", "resume_revision_metadata", metadataRevId);

  // ── consultant_title ──────────────────────────────────────────────────────
  if (content.consultantTitle !== null && content.consultantTitle !== undefined) {
    const ctRevId = baseContent !== null
      && baseContent.consultantTitle === content.consultantTitle
      && baseRevisionIds["consultant_title"]?.[0]
      ? baseRevisionIds["consultant_title"][0]
      : (await trx
          .insertInto("resume_revision_consultant_title")
          .values({ value: content.consultantTitle })
          .returning("id")
          .executeTakeFirstOrThrow()).id;
    await addEntry("consultant_title", "resume_revision_consultant_title", ctRevId);
  }

  // ── presentation ──────────────────────────────────────────────────────────
  const presentationRevId = baseContent !== null
    && equalsByJson(baseContent.presentation ?? [], content.presentation ?? [])
    && baseRevisionIds["presentation"]?.[0]
    ? baseRevisionIds["presentation"][0]
    : (await trx
        .insertInto("resume_revision_presentation")
        .values({ paragraphs: content.presentation ?? [] })
        .returning("id")
        .executeTakeFirstOrThrow()).id;
  await addEntry("presentation", "resume_revision_presentation", presentationRevId);

  // ── summary ───────────────────────────────────────────────────────────────
  if (content.summary !== null && content.summary !== undefined) {
    const summaryRevId = baseContent !== null
      && baseContent.summary === content.summary
      && baseRevisionIds["summary"]?.[0]
      ? baseRevisionIds["summary"][0]
      : (await trx
          .insertInto("resume_revision_summary")
          .values({ content: content.summary })
          .returning("id")
          .executeTakeFirstOrThrow()).id;
    await addEntry("summary", "resume_revision_summary", summaryRevId);
  }

  // ── highlighted_items ─────────────────────────────────────────────────────
  if (
    baseContent !== null
    && equalsByJson(baseContent.highlightedItems ?? [], content.highlightedItems ?? [])
    && baseRevisionIds["highlighted_items"]?.[0]
  ) {
    await addEntry("highlighted_items", "resume_revision_highlighted_item", baseRevisionIds["highlighted_items"][0]!);
  } else {
    const { id: highlightedRevId } = await trx
      .insertInto("resume_revision_highlighted_item")
      .values({ items: content.highlightedItems ?? [] })
      .returning("id")
      .executeTakeFirstOrThrow();
    await addEntry("highlighted_items", "resume_revision_highlighted_item", highlightedRevId);
  }

  // ── skill_groups ──────────────────────────────────────────────────────────
  // Track inserted group revision IDs by name for use in the skills loop below.
  const groupRevIdByName = new Map<string, string>();
  if (
    baseContent !== null
    && equalsByJson(baseContent.skillGroups ?? [], content.skillGroups ?? [])
    && (baseRevisionIds["skill_group"]?.length ?? 0) === content.skillGroups.length
  ) {
    for (const [index, group] of content.skillGroups.entries()) {
      const groupRevId = baseRevisionIds["skill_group"]?.[index];
      if (!groupRevId) continue;
      groupRevIdByName.set(group.name, groupRevId);
      await addEntry("skill_group", "resume_revision_skill_group", groupRevId);
    }
  } else {
    for (const group of content.skillGroups) {
      const { id: groupRevId } = await trx
        .insertInto("resume_revision_skill_group")
        .values({ name: group.name, sort_order: group.sortOrder })
        .returning("id")
        .executeTakeFirstOrThrow();
      groupRevIdByName.set(group.name, groupRevId);
      await addEntry("skill_group", "resume_revision_skill_group", groupRevId);
    }
  }

  // ── skills ────────────────────────────────────────────────────────────────
  if (
    baseContent !== null
    && equalsByJson(baseContent.skills ?? [], content.skills ?? [])
    && (baseRevisionIds["skill"]?.length ?? 0) === content.skills.length
  ) {
    for (const [index] of content.skills.entries()) {
      const skillRevId = baseRevisionIds["skill"]?.[index];
      if (!skillRevId) continue;
      await addEntry("skill", "resume_revision_skill", skillRevId);
    }
  } else {
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
  }

  // ── assignments ───────────────────────────────────────────────────────────
  if (
    baseContent !== null
    && equalsByJson(baseContent.assignments ?? [], content.assignments ?? [])
    && (baseRevisionIds["assignment"]?.length ?? 0) === content.assignments.length
  ) {
    for (const [index] of content.assignments.entries()) {
      const assignmentRevId = baseRevisionIds["assignment"]?.[index];
      if (!assignmentRevId) continue;
      await addEntry("assignment", "resume_revision_assignment", assignmentRevId);
    }
  } else {
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
          keywords: assignment.keywords,
          start_date: startDate,
          end_date: endDate,
          is_current: assignment.isCurrent,
          sort_order: assignment.sortOrder,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await addEntry("assignment", "resume_revision_assignment", assignmentRevId);
    }
  }

  // ── education (snapshot from employee record) ─────────────────────────────
  if (
    baseContent !== null
    && equalsByJson(baseContent.education ?? [], content.education ?? [])
    && (baseRevisionIds["education"]?.length ?? 0) === (content.education?.length ?? 0)
  ) {
    for (const [index] of (content.education ?? []).entries()) {
      const eduRevId = baseRevisionIds["education"]?.[index];
      if (!eduRevId) continue;
      await addEntry("education", "resume_revision_education", eduRevId);
    }
  } else {
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
  }

  return treeId;
}
