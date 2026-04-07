import { sql, type Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_legacy_resume_consultant_fields
//
// Removes consultant_title and presentation from resumes now that both fields
// are sourced from resume commit content instead of the live resume row.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE resumes DROP COLUMN consultant_title`.execute(db);
  await sql`ALTER TABLE resumes DROP COLUMN presentation`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resumes")
    .addColumn("consultant_title", "text")
    .addColumn("presentation", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .execute();
}
