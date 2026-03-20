import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_deleted_at_to_assignments
//
// Adds a soft-delete column to the assignments table. Setting deleted_at
// marks an assignment as deleted across all branches without removing the
// identity row (which would cascade-delete all branch_assignments content).
//
// All read queries must filter WHERE deleted_at IS NULL.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  await db.schema
    .createIndex("assignments_deleted_at_idx")
    .on("assignments")
    .column("deleted_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .dropColumn("deleted_at")
    .execute();
}
