import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: extend_assignments_and_employees
//
// assignments
//   keywords      — free-text keywords/tags for the assignment (nullable)
//
// employees
//   title         — consultant title, e.g. "Tech Lead / Senior Engineer"
//   presentation  — array of presentation paragraphs stored as JSONB
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .addColumn("keywords", "text")
    .execute();

  await db.schema
    .alterTable("employees")
    .addColumn("title", "text")
    .execute();

  await db.schema
    .alterTable("employees")
    .addColumn("presentation", "jsonb", (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assignments")
    .dropColumn("keywords")
    .execute();

  await db.schema
    .alterTable("employees")
    .dropColumn("presentation")
    .execute();

  await db.schema
    .alterTable("employees")
    .dropColumn("title")
    .execute();
}
