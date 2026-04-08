import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // ── Types registry ────────────────────────────────────────────────────────
  await db.schema
    .createTable("resume_entry_types")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("revision_table", "text", (col) => col.notNull())
    .execute();

  await sql`
    INSERT INTO resume_entry_types (name, revision_table) VALUES
      ('metadata',          'resume_metadata_revisions'),
      ('consultant_title',  'consultant_title_revisions'),
      ('presentation',      'presentation_revisions'),
      ('summary',           'summary_revisions'),
      ('highlighted_items', 'highlighted_item_revisions'),
      ('skill_group',       'skill_group_revisions'),
      ('skill',             'skill_revisions'),
      ('assignment',        'assignment_revisions'),
      ('education',         'education_revisions')
    ON CONFLICT (name) DO NOTHING
  `.execute(db);

  // ── Tree tables ───────────────────────────────────────────────────────────
  await db.schema
    .createTable("resume_trees")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("resume_tree_entries")
    .ifNotExists()
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("tree_id", "uuid", (col) =>
      col.notNull().references("resume_trees.id").onDelete("cascade"),
    )
    .addColumn("entry_type", "text", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .execute();

  // ── Coupling table (polymorphic revision references) ──────────────────────
  // revision_id is logical (no FK) to support polymorphism across revision tables.
  // revision_type identifies which table to query.
  await db.schema
    .createTable("resume_tree_entry_content")
    .ifNotExists()
    .addColumn("entry_id", "uuid", (col) =>
      col.notNull().references("resume_tree_entries.id").onDelete("cascade"),
    )
    .addColumn("revision_id", "uuid", (col) => col.notNull())
    .addColumn("revision_type", "text", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_resume_tree_entry_content", ["entry_id"])
    .execute();

  // ── tree_id on resume_commits ─────────────────────────────────────────────
  // Nullable: commits created before this model have no tree.
  await db.schema
    .alterTable("resume_commits")
    .addColumn("tree_id", "uuid", (col) =>
      col.references("resume_trees.id"),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("resume_commits").dropColumn("tree_id").execute();

  await db.schema.dropTable("resume_tree_entry_content").ifExists().execute();
  await db.schema.dropTable("resume_tree_entries").ifExists().execute();
  await db.schema.dropTable("resume_trees").ifExists().execute();
  await db.schema.dropTable("resume_entry_types").ifExists().execute();
}
