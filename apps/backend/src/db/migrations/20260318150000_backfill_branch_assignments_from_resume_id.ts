import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: backfill_branch_assignments_from_resume_id
//
// For every main branch that currently has no branch_assignments rows, seeds
// the table from assignments.resume_id — the legacy scoping field that was
// used before per-branch assignment linking was introduced.
//
// Idempotent: only processes main branches that have no branch_assignments yet.
//
// sort_order is assigned by start_date DESC so the most recent assignment
// appears first, matching the default display order.
// ---------------------------------------------------------------------------

interface BranchRow {
  branch_id: string;
  resume_id: string;
}

interface AssignmentRow {
  id: string;
  highlight: boolean;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // Find all main branches that have no branch_assignments yet
  const branches = await sql<BranchRow>`
    SELECT rb.id AS branch_id, rb.resume_id
    FROM resume_branches rb
    WHERE rb.is_main = true
      AND NOT EXISTS (
        SELECT 1 FROM branch_assignments ba WHERE ba.branch_id = rb.id
      )
  `.execute(db);

  if (branches.rows.length === 0) return;

  for (const branch of branches.rows) {
    // Fetch assignments for this resume ordered by start_date DESC
    const assignments = await sql<AssignmentRow>`
      SELECT id, highlight
      FROM assignments
      WHERE resume_id = ${branch.resume_id}
      ORDER BY start_date DESC
    `.execute(db);

    if (assignments.rows.length === 0) continue;

    for (let i = 0; i < assignments.rows.length; i++) {
      const assignment = assignments.rows[i]!;
      await sql`
        INSERT INTO branch_assignments (branch_id, assignment_id, highlight, sort_order)
        VALUES (${branch.branch_id}, ${assignment.id}, ${assignment.highlight}, ${i})
        ON CONFLICT (branch_id, assignment_id) DO NOTHING
      `.execute(db);
    }
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Remove all branch_assignments rows that were backfilled from main branches
  // (those whose assignment has a matching resume_id on the branch's resume)
  await sql`
    DELETE FROM branch_assignments ba
    USING resume_branches rb, assignments a
    WHERE ba.branch_id = rb.id
      AND rb.is_main = true
      AND ba.assignment_id = a.id
      AND a.resume_id = rb.resume_id
  `.execute(db);
}
