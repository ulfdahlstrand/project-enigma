import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_education
//
// education
//   id          — UUID primary key
//   employee_id — FK → employees.id (cascade delete)
//   type        — 'degree' | 'certification' | 'language'
//   value       — the actual text, e.g. "Civilingenjör i Medieteknik"
//   sort_order  — display ordering within each type group
//   created_at  — set on insert
//   updated_at  — set on insert, updated on change
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("education")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade")
    )
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createIndex("education_employee_id_idx")
    .on("education")
    .column("employee_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("education_employee_id_idx").execute();
  await db.schema.dropTable("education").execute();
}
