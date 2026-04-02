import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_title_description_to_resume_commits
//
// Introduces `title` and `description` columns on resume_commits, replacing
// the single `message` field as the canonical human-readable metadata.
//
// Backfill strategy:
//   - title      ← message (preserves existing display text)
//   - description ← '' (empty; historical commits have no extended description)
//
// The `message` column is left in place for backward compatibility.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_commits")
    .addColumn("title", "text", (col) => col.notNull().defaultTo(""))
    .execute();

  await db.schema
    .alterTable("resume_commits")
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .execute();

  // Backfill: copy existing message into title so history stays readable
  await sql`UPDATE resume_commits SET title = message WHERE title = ''`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("resume_commits").dropColumn("description").execute();
  await db.schema.alterTable("resume_commits").dropColumn("title").execute();
}
