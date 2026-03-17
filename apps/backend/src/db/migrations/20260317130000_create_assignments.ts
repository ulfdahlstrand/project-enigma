import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_assignments
//
// Creates the `assignments` table — work history entries for an employee,
// optionally linked to a specific resume.
//
// assignments
//   id            — UUID primary key
//   employee_id   — FK → employees.id (cascade delete)
//   resume_id     — FK → resumes.id (set null on delete), nullable
//   client_name   — client / company name
//   role          — job title / role at the engagement
//   description   — free-text description of responsibilities
//   start_date    — engagement start date
//   end_date      — engagement end date, null if is_current
//   technologies  — array of technology tags, e.g. ["TypeScript","React"]
//   is_current    — true while the engagement is ongoing
//   created_at    — set on insert
//   updated_at    — set on insert, updated on change
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("assignments")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade")
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.references("resumes.id").onDelete("set null")
    )
    .addColumn("client_name", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("start_date", "date", (col) => col.notNull())
    .addColumn("end_date", "date")
    .addColumn("technologies", sql`text[]`, (col) =>
      col.notNull().defaultTo(sql`'{}'::text[]`)
    )
    .addColumn("is_current", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createIndex("assignments_employee_id_idx")
    .on("assignments")
    .column("employee_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("assignments_employee_id_idx").execute();
  await db.schema.dropTable("assignments").execute();
}
