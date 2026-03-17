import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: rename CV-related tables and indexes to use "resume" terminology.
//
// Renames:
//   - Table:  cvs          → resumes
//   - Table:  cv_skills    → resume_skills
//   - Index:  cvs_employee_id_idx → resumes_employee_id_idx
//   - Index:  cvs_language_idx    → resumes_language_idx
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("cvs").renameTo("resumes").execute();
  await db.schema.alterTable("cv_skills").renameTo("resume_skills").execute();

  await sql`ALTER INDEX IF EXISTS cvs_employee_id_idx RENAME TO resumes_employee_id_idx`.execute(db);
  await sql`ALTER INDEX IF EXISTS cvs_language_idx RENAME TO resumes_language_idx`.execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER INDEX IF EXISTS resumes_language_idx RENAME TO cvs_language_idx`.execute(db);
  await sql`ALTER INDEX IF EXISTS resumes_employee_id_idx RENAME TO cvs_employee_id_idx`.execute(db);

  await db.schema.alterTable("resume_skills").renameTo("cv_skills").execute();
  await db.schema.alterTable("resumes").renameTo("cvs").execute();
}
