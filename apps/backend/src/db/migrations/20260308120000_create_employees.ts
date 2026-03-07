import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_employees
//
// Creates the `employees` table with identification and audit columns.
// This is the foundational table for all employee-related features.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("employees")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("employees").execute();
}
