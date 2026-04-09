import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_live_skill_tables
//
// resume_skill_groups, resume_skills, and resume_highlighted_items were the
// mutable "live" tables that held the current state of skills and highlighted
// items per resume. All read/write paths have been migrated to the Git-inspired
// content model (tree layer via resume_trees / revision tables), and the
// per-item CRUD API endpoints have been removed in Phase 4 of epic 506.
//
// These tables are now safe to drop.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS resume_highlighted_items`.execute(db);
  await sql`DROP TABLE IF EXISTS resume_skills`.execute(db);
  await sql`DROP TABLE IF EXISTS resume_skill_groups`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS resume_skill_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      name text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS resume_skills (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      group_id uuid REFERENCES resume_skill_groups(id) ON DELETE SET NULL,
      name text NOT NULL,
      category text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS resume_highlighted_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      content text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
}
