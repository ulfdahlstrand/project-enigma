import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_commit_tags
//
// Introduces the commit_tags table for cross-resume translation links.
// Each row pins two commits (source and target) across different-language
// resumes as corresponding to each other.
//
// resumes.language already exists — no column added here.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("commit_tags")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("source_commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("target_commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("kind", "varchar(32)", (col) =>
      col.notNull().defaultTo('translation')
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("created_by", "uuid", (col) =>
      col.references("employees.id").onDelete("set null")
    )
    .addUniqueConstraint("commit_tags_unique_source_target_kind", [
      "source_commit_id",
      "target_commit_id",
      "kind",
    ])
    .execute();

  await db.schema
    .createIndex("idx_commit_tags_source")
    .on("commit_tags")
    .column("source_commit_id")
    .execute();

  await db.schema
    .createIndex("idx_commit_tags_target")
    .on("commit_tags")
    .column("target_commit_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_commit_tags_target").execute();
  await db.schema.dropIndex("idx_commit_tags_source").execute();
  await db.schema.dropTable("commit_tags").execute();
}
