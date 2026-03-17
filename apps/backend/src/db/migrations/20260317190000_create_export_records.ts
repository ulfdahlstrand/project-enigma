import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_export_records
//
// Stores metadata for every CV export. The `id` (reference_id) is the only
// identifier exposed in exported files — resume_id and employee_id stay
// server-side. Allows future lookup of export context without embedding
// internal IDs in downloaded documents.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("export_records")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade")
    )
    .addColumn("format", "text", (col) => col.notNull())
    .addColumn("filename", "text", (col) => col.notNull())
    .addColumn("exported_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("export_records").execute();
}
