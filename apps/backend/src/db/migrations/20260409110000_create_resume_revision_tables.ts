import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // ── resume_revision_metadata ─────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_metadata")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_consultant_title ────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_consultant_title")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_presentation ────────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_presentation")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("paragraphs", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_summary ─────────────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_summary")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_highlighted_item ────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_highlighted_item")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("items", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_skill_group ─────────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_skill_group")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_skill ───────────────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_skill")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("group_revision_id", "uuid", (col) =>
      col.notNull().references("resume_revision_skill_group.id"),
    )
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // ── resume_revision_assignment ──────────────────────────────────────────────────
  await db.schema
    .createTable("resume_revision_assignment")
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

  // ── resume_revision_education ───────────────────────────────────────────────────
  // Snapshots employee education at commit time. The live `education` table
  // remains the source of truth for the employee profile view.
  await db.schema
    .createTable("resume_revision_education")
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
  await db.schema.dropTable("resume_revision_education").ifExists().execute();
  await db.schema.dropTable("resume_revision_assignment").ifExists().execute();
  await db.schema.dropTable("resume_revision_skill").ifExists().execute();
  await db.schema.dropTable("resume_revision_skill_group").ifExists().execute();
  await db.schema.dropTable("resume_revision_highlighted_item").ifExists().execute();
  await db.schema.dropTable("resume_revision_summary").ifExists().execute();
  await db.schema.dropTable("resume_revision_presentation").ifExists().execute();
  await db.schema.dropTable("resume_revision_consultant_title").ifExists().execute();
  await db.schema.dropTable("resume_revision_metadata").ifExists().execute();
}
