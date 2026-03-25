import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_resume_highlighted_items
//
// Stores the free-text "EXEMPEL PÅ ERFARENHET" bullet list on the resume
// cover page. Each row is one bullet item, ordered by sort_order.
// Scoped to a resume (not a branch) — global editable list per resume.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_highlighted_items")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("text", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createIndex("resume_highlighted_items_resume_id_idx")
    .on("resume_highlighted_items")
    .column("resume_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("resume_highlighted_items").execute();
}
