import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_legacy_resume_commit_columns
//
// resume_commits.branch_id and resume_commits.parent_commit_id were kept as
// transitional compatibility columns while the app moved to:
//   - resume_branches.head_commit_id / forked_from_commit_id for branch refs
//   - resume_commit_parents for commit ancestry
//
// Runtime reads and writes no longer depend on either legacy column, so they
// can now be removed from the table shape.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE resume_commits
    DROP CONSTRAINT IF EXISTS fk_resume_commits_branch_id
  `.execute(db);

  await sql`DROP INDEX IF EXISTS idx_resume_commits_branch_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_resume_commits_parent_commit_id`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_resume_commits_root`.execute(db);

  await db.schema
    .alterTable("resume_commits")
    .dropColumn("branch_id")
    .dropColumn("parent_commit_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_commits")
    .addColumn("branch_id", "uuid")
    .addColumn("parent_commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
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

  await sql`
    CREATE INDEX idx_resume_commits_root
    ON resume_commits (resume_id)
    WHERE parent_commit_id IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE resume_commits
    ADD CONSTRAINT fk_resume_commits_branch_id
    FOREIGN KEY (branch_id)
    REFERENCES resume_branches (id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
  `.execute(db);
}
