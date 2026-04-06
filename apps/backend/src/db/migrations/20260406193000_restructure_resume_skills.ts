import { sql, type Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: restructure_resume_skills
//
// Introduces first-class resume skill groups and reshapes resume_skills:
//
// - new table: resume_skill_groups
// - resume_skills.cv_id      -> resume_id
// - resume_skills.level      removed
// - resume_skills.category   removed
// - resume_skills.group_id   added
//
// Existing rows are backfilled into groups by (resume, category), using the
// earliest skill sort order in each category as the group sort order.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_skill_groups")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable("resume_skills")
    .addColumn("resume_id", "uuid")
    .addColumn("group_id", "uuid")
    .execute();

  await sql`
    INSERT INTO resume_skill_groups (resume_id, name, sort_order)
    SELECT
      rs.cv_id,
      COALESCE(NULLIF(BTRIM(rs.category), ''), 'Other'),
      MIN(rs.sort_order)
    FROM resume_skills rs
    GROUP BY rs.cv_id, COALESCE(NULLIF(BTRIM(rs.category), ''), 'Other')
  `.execute(db);

  await sql`
    UPDATE resume_skills rs
    SET
      resume_id = rs.cv_id,
      group_id = rsg.id
    FROM resume_skill_groups rsg
    WHERE rsg.resume_id = rs.cv_id
      AND rsg.name = COALESCE(NULLIF(BTRIM(rs.category), ''), 'Other')
  `.execute(db);

  await sql`
    ALTER TABLE resume_skills
      ALTER COLUMN resume_id SET NOT NULL,
      ALTER COLUMN group_id SET NOT NULL
  `.execute(db);

  await sql`
    ALTER TABLE resume_skills
      ADD CONSTRAINT resume_skills_resume_id_fkey
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE resume_skills
      ADD CONSTRAINT resume_skills_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES resume_skill_groups(id) ON DELETE CASCADE
  `.execute(db);

  await sql`CREATE INDEX resume_skill_groups_resume_id_idx ON resume_skill_groups (resume_id)`.execute(db);
  await sql`CREATE INDEX resume_skills_resume_id_idx ON resume_skills (resume_id)`.execute(db);
  await sql`CREATE INDEX resume_skills_group_id_idx ON resume_skills (group_id)`.execute(db);

  await sql`ALTER TABLE resume_skills DROP COLUMN level`.execute(db);
  await sql`ALTER TABLE resume_skills DROP COLUMN category`.execute(db);
  await sql`ALTER TABLE resume_skills DROP COLUMN cv_id`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_skills")
    .addColumn("cv_id", "uuid")
    .addColumn("level", "varchar(50)")
    .addColumn("category", "text")
    .execute();

  await sql`
    UPDATE resume_skills rs
    SET
      cv_id = rs.resume_id,
      category = rsg.name
    FROM resume_skill_groups rsg
    WHERE rsg.id = rs.group_id
  `.execute(db);

  await sql`
    ALTER TABLE resume_skills
      ALTER COLUMN cv_id SET NOT NULL
  `.execute(db);

  await sql`DROP INDEX IF EXISTS resume_skills_group_id_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS resume_skills_resume_id_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS resume_skill_groups_resume_id_idx`.execute(db);

  await sql`ALTER TABLE resume_skills DROP CONSTRAINT IF EXISTS resume_skills_group_id_fkey`.execute(db);
  await sql`ALTER TABLE resume_skills DROP CONSTRAINT IF EXISTS resume_skills_resume_id_fkey`.execute(db);

  await sql`ALTER TABLE resume_skills DROP COLUMN group_id`.execute(db);
  await sql`ALTER TABLE resume_skills DROP COLUMN resume_id`.execute(db);

  await db.schema.dropTable("resume_skill_groups").execute();
}
