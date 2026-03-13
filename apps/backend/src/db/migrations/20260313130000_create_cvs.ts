import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_cvs
//
// Creates the `cvs` table (one CV document per employee per language) and
// the `cv_skills` table (skills attached to a CV).
//
// cvs
//   id           — UUID primary key
//   employee_id  — FK → employees.id (cascade delete)
//   title        — display title for the CV variant, e.g. "Tech Lead CV"
//   summary      — optional free-text professional summary
//   language     — BCP-47 locale code, e.g. "en" or "sv"
//   is_main      — true for the canonical CV; only one per employee
//   created_at   — set on insert
//   updated_at   — set on insert, updated on change
//
// cv_skills
//   id           — UUID primary key
//   cv_id        — FK → cvs.id (cascade delete)
//   name         — skill name, e.g. "TypeScript"
//   level        — optional proficiency label, e.g. "Expert"
//   category     — optional grouping, e.g. "Languages"
//   sort_order   — display ordering within category
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("cvs")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade")
    )
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("summary", "text")
    .addColumn("language", "varchar(10)", (col) =>
      col.notNull().defaultTo("en")
    )
    .addColumn("is_main", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createTable("cv_skills")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("cv_id", "uuid", (col) =>
      col.notNull().references("cvs.id").onDelete("cascade")
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("level", "varchar(50)")
    .addColumn("category", "varchar(100)")
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createIndex("cvs_employee_id_idx")
    .on("cvs")
    .column("employee_id")
    .execute();

  await db.schema
    .createIndex("cvs_language_idx")
    .on("cvs")
    .column("language")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("cvs_language_idx").execute();
  await db.schema.dropIndex("cvs_employee_id_idx").execute();
  await db.schema.dropTable("cv_skills").execute();
  await db.schema.dropTable("cvs").execute();
}
