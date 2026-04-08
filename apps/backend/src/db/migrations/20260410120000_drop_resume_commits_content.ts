import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_resume_commits_content
//
// resume_commits.content (JSONB) was the original full-snapshot column written
// by saveResumeVersion. All read paths have been switched to the tree layer
// (tree_id → resume_trees → revision tables) in Phase 2–3, and the dual-write
// has been removed in Phase 4. The column is now safe to drop.
//
// Prerequisites before running:
//   - All commits must have tree_id set (run backfill-commit-trees script first).
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_commits")
    .dropColumn("content")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Restore as nullable — historical data cannot be recovered.
  await sql`
    ALTER TABLE resume_commits
    ADD COLUMN content jsonb
  `.execute(db);
}
