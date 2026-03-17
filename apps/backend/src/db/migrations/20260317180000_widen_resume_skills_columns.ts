import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: widen_resume_skills_columns
//
// resume_skills.name was varchar(255) — too short for long skill strings
// imported from CV JSON (e.g. full technology stack lines).
// resume_skills.category was varchar(100) — widened to text for consistency.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_skills")
    .alterColumn("name", (col) => col.setDataType("text"))
    .execute();

  await db.schema
    .alterTable("resume_skills")
    .alterColumn("category", (col) => col.setDataType("text"))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_skills")
    .alterColumn("category", (col) => col.setDataType("varchar(100)"))
    .execute();

  await db.schema
    .alterTable("resume_skills")
    .alterColumn("name", (col) => col.setDataType("varchar(255)"))
    .execute();
}
