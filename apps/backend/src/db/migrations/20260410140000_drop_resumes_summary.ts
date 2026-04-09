import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_resumes_summary
//
// resumes.summary was a denormalized mirror of the summary stored in the
// Git-inspired content model (resume_revision_summary via the tree layer).
// All read paths now go through readTreeContent and all write paths go through
// upsertBranchContentFromLive / saveResumeVersion. The column is safe to drop.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resumes")
    .dropColumn("summary")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE resumes
    ADD COLUMN summary text
  `.execute(db);
}
