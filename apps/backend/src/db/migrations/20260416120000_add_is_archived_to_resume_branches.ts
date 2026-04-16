import { type Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_is_archived_to_resume_branches
//
// Adds soft-archive support so branches can be hidden from the UI without
// permanent deletion. Archived branches are excluded from the compare picker
// and branch list by default but can be revealed via a filter toggle.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_branches")
    .addColumn("is_archived", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_branches")
    .dropColumn("is_archived")
    .execute();
}
