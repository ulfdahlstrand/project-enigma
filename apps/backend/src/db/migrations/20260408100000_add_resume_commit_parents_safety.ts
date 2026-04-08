import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_resume_commit_parents_safety
//
// The create migration (20260326143000_create_resume_commit_parents) built
// the table and ran an initial backfill, but it is missing three safety
// properties required by issue #498:
//
//   1. No CHECK constraint preventing self-referential edges.
//   2. No UNIQUE constraint on (commit_id, parent_commit_id) — the existing
//      PK is (commit_id, parent_order), which still allows the same parent
//      to be inserted twice with different order values.
//   3. The original backfill sourced from resume_commits.parent_commit_id
//      which is always NULL, so it was a no-op.
//
// This migration patches all three gaps and is fully idempotent:
//   - Constraints are added only if they do not already exist (DO block).
//   - Backfill uses NOT EXISTS to skip commits already linked.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  // Remove any self-referential rows before adding the CHECK constraint.
  await sql`
    DELETE FROM resume_commit_parents
    WHERE commit_id = parent_commit_id
  `.execute(db);

  // Add CHECK constraint — idempotent via pg_constraint check.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_resume_commit_parents_no_self_ref'
      ) THEN
        ALTER TABLE resume_commit_parents
        ADD CONSTRAINT chk_resume_commit_parents_no_self_ref
        CHECK (commit_id <> parent_commit_id);
      END IF;
    END $$
  `.execute(db);

  // Add UNIQUE constraint — idempotent via pg_constraint check.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_resume_commit_parents_edge'
      ) THEN
        ALTER TABLE resume_commit_parents
        ADD CONSTRAINT uq_resume_commit_parents_edge
        UNIQUE (commit_id, parent_commit_id);
      END IF;
    END $$
  `.execute(db);

  // Backfill parent relationships by inferring the linear commit chain per
  // branch. resume_commits.parent_commit_id is always NULL — the app writes
  // parent edges directly to resume_commit_parents — so we cannot source the
  // backfill from that column.
  //
  // Instead: for each branch, order commits by created_at and link each commit
  // to its immediate predecessor (LAG). This is the unambiguous ancestry
  // inference described in issue #498.
  //
  // NOT EXISTS makes this idempotent: commits that already have a parent at
  // order 0 (written by the app or a previous backfill) are left untouched.
  await sql`
    WITH ordered_commits AS (
      SELECT
        id,
        LAG(id) OVER (PARTITION BY branch_id ORDER BY created_at) AS inferred_parent_id
      FROM resume_commits
      WHERE branch_id IS NOT NULL
    )
    INSERT INTO resume_commit_parents (commit_id, parent_commit_id, parent_order)
    SELECT oc.id, oc.inferred_parent_id, 0
    FROM ordered_commits oc
    WHERE oc.inferred_parent_id IS NOT NULL
      AND oc.id != oc.inferred_parent_id
      AND NOT EXISTS (
        SELECT 1
        FROM resume_commit_parents rcp
        WHERE rcp.commit_id = oc.id
          AND rcp.parent_order = 0
      )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE resume_commit_parents
    DROP CONSTRAINT IF EXISTS uq_resume_commit_parents_edge
  `.execute(db);

  await sql`
    ALTER TABLE resume_commit_parents
    DROP CONSTRAINT IF EXISTS chk_resume_commit_parents_no_self_ref
  `.execute(db);
}
