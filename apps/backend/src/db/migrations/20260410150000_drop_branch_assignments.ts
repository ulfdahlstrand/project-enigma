import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_branch_assignments
//
// The application no longer reads or writes the legacy branch_assignments
// table. Branch-scoped assignment content now lives in resume commit trees
// (assignment_revisions inside resume_trees), so the old table is dead weight.
//
// This migration removes the table and its indexes. The down migration
// recreates the last known schema so we can roll back safely if needed.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS branch_assignments`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS branch_assignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id uuid NOT NULL REFERENCES resume_branches(id) ON DELETE CASCADE,
      assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      client_name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '',
      start_date date NOT NULL DEFAULT CURRENT_DATE,
      end_date date,
      technologies text[] NOT NULL DEFAULT '{}'::text[],
      is_current boolean NOT NULL DEFAULT false,
      keywords text,
      type text,
      highlight boolean NOT NULL DEFAULT false,
      sort_order integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_branch_assignments_branch_assignment UNIQUE (branch_id, assignment_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_assignments_branch_id
    ON branch_assignments (branch_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_assignments_assignment_id
    ON branch_assignments (assignment_id)
  `.execute(db);
}
