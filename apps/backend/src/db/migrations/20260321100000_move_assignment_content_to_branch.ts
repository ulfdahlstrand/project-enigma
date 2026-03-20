import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Move all mutable assignment content from the shared `assignments` table into
 * `branch_assignments`. After this migration:
 *
 *   assignments       → identity only (id, employee_id, created_at)
 *   branch_assignments → owns all content per branch
 *
 * This makes assignment content branch-specific: editing on branch A does not
 * affect branch B.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Add content columns to branch_assignments
  await db.schema
    .alterTable("branch_assignments")
    .addColumn("client_name", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("role", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("start_date", "date", (col) => col.notNull().defaultTo(sql`CURRENT_DATE`))
    .addColumn("end_date", "date")
    .addColumn("technologies", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("is_current", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("keywords", "text")
    .addColumn("type", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // 2. Backfill content from assignments into branch_assignments
  await sql`
    UPDATE branch_assignments ba
    SET
      client_name  = a.client_name,
      role         = a.role,
      description  = a.description,
      start_date   = a.start_date,
      end_date     = a.end_date,
      technologies = a.technologies,
      is_current   = a.is_current,
      keywords     = a.keywords,
      type         = a.type,
      created_at   = a.created_at,
      updated_at   = a.updated_at
    FROM assignments a
    WHERE ba.assignment_id = a.id
  `.execute(db);

  // 3. Drop content columns from assignments (identity only remains)
  await db.schema
    .alterTable("assignments")
    .dropColumn("client_name")
    .dropColumn("role")
    .dropColumn("description")
    .dropColumn("start_date")
    .dropColumn("end_date")
    .dropColumn("technologies")
    .dropColumn("is_current")
    .dropColumn("keywords")
    .dropColumn("type")
    .dropColumn("highlight")
    .dropColumn("updated_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // 1. Restore content columns on assignments
  await db.schema
    .alterTable("assignments")
    .addColumn("client_name", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("role", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("start_date", "date", (col) => col.notNull().defaultTo(sql`CURRENT_DATE`))
    .addColumn("end_date", "date")
    .addColumn("technologies", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("is_current", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("keywords", "text")
    .addColumn("type", "text")
    .addColumn("highlight", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // 2. Restore content from branch_assignments back into assignments
  //    Use the latest branch_assignment row per assignment_id
  await sql`
    UPDATE assignments a
    SET
      client_name  = ba.client_name,
      role         = ba.role,
      description  = ba.description,
      start_date   = ba.start_date,
      end_date     = ba.end_date,
      technologies = ba.technologies,
      is_current   = ba.is_current,
      keywords     = ba.keywords,
      type         = ba.type,
      updated_at   = ba.updated_at
    FROM (
      SELECT DISTINCT ON (assignment_id)
        assignment_id, client_name, role, description, start_date, end_date,
        technologies, is_current, keywords, type, updated_at
      FROM branch_assignments
      ORDER BY assignment_id, updated_at DESC
    ) ba
    WHERE a.id = ba.assignment_id
  `.execute(db);

  // 3. Drop content columns from branch_assignments
  await db.schema
    .alterTable("branch_assignments")
    .dropColumn("client_name")
    .dropColumn("role")
    .dropColumn("description")
    .dropColumn("start_date")
    .dropColumn("end_date")
    .dropColumn("technologies")
    .dropColumn("is_current")
    .dropColumn("keywords")
    .dropColumn("type")
    .dropColumn("created_at")
    .dropColumn("updated_at")
    .execute();
}
