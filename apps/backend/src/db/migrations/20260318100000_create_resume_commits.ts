import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_resume_commits
//
// Creates the immutable snapshot table for resume versioning. Each row
// represents a point-in-time capture of a resume branch's full content —
// analogous to a git commit.
//
// Historical note:
//   This original table shape included legacy branch_id and parent_commit_id
//   columns as transitional compatibility fields. The modern model uses:
//     - resume_branches for branch refs
//     - resume_commit_parents for commit ancestry
//   A later migration drops both legacy columns after the app has been fully
//   rewired away from them.
//
// Original circular FK note: resume_commits.branch_id → resume_branches, and
// resume_branches.head_commit_id → resume_commits. To break this cycle:
//   1. This migration creates resume_commits WITHOUT branch_id FK.
//   2. The next migration (create_resume_branches) creates resume_branches,
//      then adds branch_id as a DEFERRABLE FK back onto resume_commits.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_commits")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    // Legacy compatibility column. Dropped by a later cleanup migration.
    .addColumn("branch_id", "uuid")
    // Legacy compatibility column. Replaced by resume_commit_parents.
    .addColumn("parent_commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .addColumn("content", "jsonb", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("created_by", "uuid", (col) =>
      col.references("users.id").onDelete("set null")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createIndex("idx_resume_commits_resume_id")
    .on("resume_commits")
    .column("resume_id")
    .execute();

  await db.schema
    .createIndex("idx_resume_commits_branch_id")
    .on("resume_commits")
    .column("branch_id")
    .execute();

  await db.schema
    .createIndex("idx_resume_commits_parent_commit_id")
    .on("resume_commits")
    .column("parent_commit_id")
    .execute();

  await db.schema
    .createIndex("idx_resume_commits_created_at")
    .on("resume_commits")
    .column("created_at")
    .execute();

  // Add a partial index for finding root commits (no parent) efficiently
  await sql`
    CREATE INDEX idx_resume_commits_root
    ON resume_commits (resume_id)
    WHERE parent_commit_id IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("resume_commits").execute();
}
