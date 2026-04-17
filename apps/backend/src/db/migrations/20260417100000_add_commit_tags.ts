import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_commit_tags
//
// Introduces the commit_tags table for cross-resume translation links.
// Each row pins two commits (source → target) across different-language resumes.
// Uniqueness is enforced per resume pair + kind so upsert replaces in-place.
//
// resumes.language already exists — no column added here.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("commit_tags")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("source_resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("target_resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("source_commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("target_commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("kind", "varchar(32)", (col) =>
      col.notNull().defaultTo("translation")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("created_by", "uuid", (col) =>
      col.references("employees.id").onDelete("set null")
    )
    .addUniqueConstraint("commit_tags_unique_source_target_resume_kind", [
      "source_resume_id",
      "target_resume_id",
      "kind",
    ])
    .execute();

  await db.schema
    .createIndex("idx_commit_tags_source_resume")
    .on("commit_tags")
    .column("source_resume_id")
    .execute();

  await db.schema
    .createIndex("idx_commit_tags_target_resume")
    .on("commit_tags")
    .column("target_resume_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_commit_tags_target_resume").execute();
  await db.schema.dropIndex("idx_commit_tags_source_resume").execute();
  await db.schema.dropTable("commit_tags").execute();
}
