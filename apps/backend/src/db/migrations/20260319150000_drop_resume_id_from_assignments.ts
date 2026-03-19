import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: drop_resume_id_from_assignments
//
// assignments.resume_id was a legacy FK used before the branch_assignments
// join table was introduced. All assignment-to-branch linking now goes through
// branch_assignments exclusively. The column is no longer written or read.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .dropColumn("resume_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .addColumn("resume_id", "uuid", (col) =>
      col.references("resumes.id").onDelete("set null")
    )
    .execute();
}
