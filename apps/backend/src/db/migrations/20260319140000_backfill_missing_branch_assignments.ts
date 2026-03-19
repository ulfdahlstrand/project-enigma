import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: backfill_missing_branch_assignments
//
// The original backfill (20260318150000) only processed main branches that had
// NO branch_assignments rows at all. Any assignments added via the legacy
// assignments.resume_id path after that migration ran will be missing from
// branch_assignments.
//
// This migration inserts all such missing rows using ON CONFLICT DO NOTHING,
// making it safe to run multiple times.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO branch_assignments (branch_id, assignment_id, highlight, sort_order)
    SELECT rb.id, a.id, a.highlight, ROW_NUMBER() OVER (
      PARTITION BY rb.id ORDER BY a.start_date DESC
    ) - 1
    FROM assignments a
    JOIN resumes r ON r.id = a.resume_id
    JOIN resume_branches rb ON rb.resume_id = r.id AND rb.is_main = true
    WHERE a.resume_id IS NOT NULL
    ON CONFLICT (branch_id, assignment_id) DO NOTHING
  `.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Not reversible — would risk removing legitimately added branch_assignments rows
}
