import type { Kysely } from "kysely";
import { sql } from "kysely";

const TABLE_RENAMES = [
  ["resume_metadata_revisions", "resume_revision_metadata"],
  ["consultant_title_revisions", "resume_revision_consultant_title"],
  ["presentation_revisions", "resume_revision_presentation"],
  ["summary_revisions", "resume_revision_summary"],
  ["highlighted_item_revisions", "resume_revision_highlighted_item"],
  ["skill_group_revisions", "resume_revision_skill_group"],
  ["skill_revisions", "resume_revision_skill"],
  ["assignment_revisions", "resume_revision_assignment"],
  ["education_revisions", "resume_revision_education"],
] as const;

function buildCaseExpression(direction: "forward" | "backward") {
  const pairs = direction === "forward" ? TABLE_RENAMES : TABLE_RENAMES.map(([from, to]) => [to, from] as const);
  return sql.join(
    pairs.map(([from, to]) => sql`WHEN ${from} THEN ${to}`),
    sql` `,
  );
}

async function renameTables(db: Kysely<unknown>, direction: "forward" | "backward") {
  const pairs = direction === "forward" ? TABLE_RENAMES : TABLE_RENAMES.map(([from, to]) => [to, from] as const);

  for (const [from, to] of pairs) {
    await sql.raw(
      `ALTER TABLE IF EXISTS "${from}" RENAME TO "${to}"`
    ).execute(db);
  }
}

async function rewriteRevisionPointers(db: Kysely<unknown>, direction: "forward" | "backward") {
  const caseExpression = buildCaseExpression(direction);
  const fromValues = direction === "forward"
    ? TABLE_RENAMES.map(([from]) => from)
    : TABLE_RENAMES.map(([, to]) => to);

  await sql`
    UPDATE resume_entry_types
    SET revision_table = CASE revision_table
      ${caseExpression}
      ELSE revision_table
    END
    WHERE revision_table IN (${sql.join(fromValues.map((value) => sql`${value}`), sql`, `)})
  `.execute(db);

  await sql`
    UPDATE resume_tree_entry_content
    SET revision_type = CASE revision_type
      ${caseExpression}
      ELSE revision_type
    END
    WHERE revision_type IN (${sql.join(fromValues.map((value) => sql`${value}`), sql`, `)})
  `.execute(db);
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await renameTables(db, "forward");
  await rewriteRevisionPointers(db, "forward");
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await renameTables(db, "backward");
  await rewriteRevisionPointers(db, "backward");
}
