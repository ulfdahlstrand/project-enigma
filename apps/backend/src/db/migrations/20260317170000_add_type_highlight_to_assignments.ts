import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_type_highlight_to_assignments
//
// assignments
//   type      — assignment type, e.g. "consulting" (nullable)
//   highlight — whether this assignment is highlighted on a CV
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .addColumn("type", "text")
    .execute();

  await db.schema
    .alterTable("assignments")
    .addColumn("highlight", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("assignments").dropColumn("highlight").execute();
  await db.schema.alterTable("assignments").dropColumn("type").execute();
}
