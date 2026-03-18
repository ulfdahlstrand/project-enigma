import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_commit_id_to_export_records
//
// Adds an optional reference from export records to the specific resume commit
// that was exported. NULL means the export used live data (legacy behavior).
// A non-null value means the export was generated from a specific saved version.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("export_records")
    .addColumn("commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("export_records")
    .dropColumn("commit_id")
    .execute();
}
