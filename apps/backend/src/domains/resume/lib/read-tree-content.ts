import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

/**
 * Reads a full ResumeCommitContent from the commit tree layer.
 *
 * For each tree entry, fetches the linked revision from its revision table
 * and assembles the result into the same shape as the legacy content JSON.
 * This is the canonical read path for the Git-inspired content model.
 *
 * Returns the same shape as ResumeCommitContent so it can be used as a
 * drop-in replacement for parsing resume_commits.content.
 */
export async function readTreeContent(
  db: Kysely<Database>,
  treeId: string,
): Promise<ResumeCommitContent> {
  const entries = await db
    .selectFrom("resume_tree_entries")
    .select(["id", "entry_type", "position"])
    .where("tree_id", "=", treeId)
    .orderBy("position", "asc")
    .execute();

  let title = "";
  let language = "en";
  let consultantTitle: string | null = null;
  let presentation: string[] = [];
  let summary: string | null = null;
  let highlightedItems: string[] = [];
  const education: ResumeCommitContent["education"] = [];
  const skillGroups: ResumeCommitContent["skillGroups"] = [];
  const skills: ResumeCommitContent["skills"] = [];
  const assignments: ResumeCommitContent["assignments"] = [];

  for (const entry of entries) {
    const coupling = await db
      .selectFrom("resume_tree_entry_content")
      .select(["revision_id", "revision_type"])
      .where("entry_id", "=", entry.id)
      .executeTakeFirst();

    if (!coupling) continue;

    const { revision_id: revisionId } = coupling;

    switch (entry.entry_type) {
      case "metadata": {
        const row = await db
          .selectFrom("resume_metadata_revisions")
          .select(["title", "language"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) {
          title = row.title;
          language = row.language;
        }
        break;
      }

      case "consultant_title": {
        const row = await db
          .selectFrom("consultant_title_revisions")
          .select(["value"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) consultantTitle = row.value;
        break;
      }

      case "presentation": {
        const row = await db
          .selectFrom("presentation_revisions")
          .select(["paragraphs"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) presentation = row.paragraphs;
        break;
      }

      case "summary": {
        const row = await db
          .selectFrom("summary_revisions")
          .select(["content"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) summary = row.content;
        break;
      }

      case "highlighted_items": {
        const row = await db
          .selectFrom("highlighted_item_revisions")
          .select(["items"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) highlightedItems = row.items;
        break;
      }

      case "skill_group": {
        const row = await db
          .selectFrom("skill_group_revisions")
          .select(["name", "sort_order"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) skillGroups.push({ name: row.name, sortOrder: row.sort_order });
        break;
      }

      case "skill": {
        const row = await db
          .selectFrom("skill_revisions")
          .select(["name", "sort_order", "group_revision_id"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) {
          const group = await db
            .selectFrom("skill_group_revisions")
            .select(["name"])
            .where("id", "=", row.group_revision_id)
            .executeTakeFirst();
          skills.push({
            name: row.name,
            category: group?.name ?? null,
            sortOrder: row.sort_order,
          });
        }
        break;
      }

      case "assignment": {
        const row = await db
          .selectFrom("assignment_revisions")
          .select([
            "assignment_id",
            "client_name",
            "role",
            "description",
            "technologies",
            "start_date",
            "end_date",
            "is_current",
            "sort_order",
          ])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) {
          assignments.push({
            assignmentId: row.assignment_id,
            clientName: row.client_name,
            role: row.role,
            description: row.description,
            startDate:
              row.start_date instanceof Date
                ? row.start_date.toISOString()
                : String(row.start_date),
            endDate:
              row.end_date instanceof Date
                ? row.end_date.toISOString()
                : row.end_date
                  ? String(row.end_date)
                  : null,
            technologies: row.technologies ?? [],
            isCurrent: row.is_current,
            keywords: null,
            type: null,
            highlight: false,
            sortOrder: row.sort_order ?? null,
          });
        }
        break;
      }

      case "education": {
        const row = await db
          .selectFrom("education_revisions")
          .select(["type", "value", "sort_order"])
          .where("id", "=", revisionId)
          .executeTakeFirst();
        if (row) {
          education.push({
            type: row.type,
            value: row.value,
            sortOrder: row.sort_order,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    title,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    language,
    education,
    skillGroups,
    skills,
    assignments,
  };
}
