import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // ── resume_metadata_revisions ─────────────────────────────────────────────
  await db.schema
    .createTable("resume_metadata_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── consultant_title_revisions ────────────────────────────────────────────
  await db.schema
    .createTable("consultant_title_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── presentation_revisions ────────────────────────────────────────────────
  await db.schema
    .createTable("presentation_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("paragraphs", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── summary_revisions ─────────────────────────────────────────────────────
  await db.schema
    .createTable("summary_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── highlighted_item_revisions ────────────────────────────────────────────
  await db.schema
    .createTable("highlighted_item_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("items", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── skill_group_revisions ─────────────────────────────────────────────────
  await db.schema
    .createTable("skill_group_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── skill_revisions ───────────────────────────────────────────────────────
  await db.schema
    .createTable("skill_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("group_revision_id", "uuid", (col) =>
      col.notNull().references("skill_group_revisions.id"),
    )
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── assignment_revisions ──────────────────────────────────────────────────
  await db.schema
    .createTable("assignment_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("assignment_id", "uuid", (col) =>
      col.notNull().references("assignments.id"),
    )
    .addColumn("client_name", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("technologies", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("start_date", "date", (col) => col.notNull())
    .addColumn("end_date", "date")
    .addColumn("is_current", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("sort_order", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── education_revisions ───────────────────────────────────────────────────
  // Snapshots employee education at commit time. The live `education` table
  // remains the source of truth for the employee profile view.
  await db.schema
    .createTable("education_revisions")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("employee_id", "uuid", (col) =>
      col.notNull().references("employees.id"),
    )
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop in reverse dependency order: skills before skill_groups, etc.
  await db.schema.dropTable("education_revisions").ifExists().execute();
  await db.schema.dropTable("assignment_revisions").ifExists().execute();
  await db.schema.dropTable("skill_revisions").ifExists().execute();
  await db.schema.dropTable("skill_group_revisions").ifExists().execute();
  await db.schema.dropTable("highlighted_item_revisions").ifExists().execute();
  await db.schema.dropTable("summary_revisions").ifExists().execute();
  await db.schema.dropTable("presentation_revisions").ifExists().execute();
  await db.schema.dropTable("consultant_title_revisions").ifExists().execute();
  await db.schema.dropTable("resume_metadata_revisions").ifExists().execute();
}
