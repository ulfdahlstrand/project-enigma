import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: commit_tags_add_resume_ids
//
// Adds source_resume_id and target_resume_id to commit_tags so that upsert
// can be keyed on the resume pair rather than on the (mutable) commit pair.
//
// After this migration there is at most one row per
// (source_resume_id, target_resume_id, kind) — "mark as updated" replaces
// the existing row in-place rather than accumulating history.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Add the two new resume-id columns (nullable to allow backfill below).
  await db.schema
    .alterTable("commit_tags")
    .addColumn("source_resume_id", "uuid", (col) =>
      col.references("resumes.id").onDelete("cascade")
    )
    .execute();

  await db.schema
    .alterTable("commit_tags")
    .addColumn("target_resume_id", "uuid", (col) =>
      col.references("resumes.id").onDelete("cascade")
    )
    .execute();

  // 2. Backfill from existing commit → resume joins.
  await sql`
    UPDATE commit_tags ct
    SET
      source_resume_id = src_rc.resume_id,
      target_resume_id = tgt_rc.resume_id
    FROM resume_commits src_rc, resume_commits tgt_rc
    WHERE src_rc.id = ct.source_commit_id
      AND tgt_rc.id = ct.target_commit_id
  `.execute(db as Parameters<typeof sql.execute>[0]);

  // 3. Make columns NOT NULL now that they are filled.
  await db.schema
    .alterTable("commit_tags")
    .alterColumn("source_resume_id", (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable("commit_tags")
    .alterColumn("target_resume_id", (col) => col.setNotNull())
    .execute();

  // 4. Remove duplicate rows (keep only the latest per resume pair + kind).
  await sql`
    DELETE FROM commit_tags
    WHERE id NOT IN (
      SELECT DISTINCT ON (source_resume_id, target_resume_id, kind) id
      FROM commit_tags
      ORDER BY source_resume_id, target_resume_id, kind, created_at DESC
    )
  `.execute(db as Parameters<typeof sql.execute>[0]);

  // 5. Drop old commit-pair unique constraint and indexes.
  await db.schema
    .dropIndex("idx_commit_tags_source")
    .execute();

  await db.schema
    .dropIndex("idx_commit_tags_target")
    .execute();

  await sql`
    ALTER TABLE commit_tags
    DROP CONSTRAINT IF EXISTS commit_tags_unique_source_target_kind
  `.execute(db as Parameters<typeof sql.execute>[0]);

  // 6. Add new resume-pair unique constraint and indexes.
  await sql`
    ALTER TABLE commit_tags
    ADD CONSTRAINT commit_tags_unique_source_target_resume_kind
    UNIQUE (source_resume_id, target_resume_id, kind)
  `.execute(db as Parameters<typeof sql.execute>[0]);

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

  await sql`
    ALTER TABLE commit_tags
    DROP CONSTRAINT IF EXISTS commit_tags_unique_source_target_resume_kind
  `.execute(db as Parameters<typeof sql.execute>[0]);

  await sql`
    ALTER TABLE commit_tags
    ADD CONSTRAINT commit_tags_unique_source_target_kind
    UNIQUE (source_commit_id, target_commit_id, kind)
  `.execute(db as Parameters<typeof sql.execute>[0]);

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

  await db.schema
    .alterTable("commit_tags")
    .dropColumn("source_resume_id")
    .execute();

  await db.schema
    .alterTable("commit_tags")
    .dropColumn("target_resume_id")
    .execute();
}
