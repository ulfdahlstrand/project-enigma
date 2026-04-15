import { type Kysely, sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_branch_type_to_resume_branches
//
// Introduces the three-branch-type model (variant / translation / revision).
// See .claude/contexts/three-branch-type-model.md for full design rationale.
//
// Changes:
//   1. branch_type varchar(16) NOT NULL DEFAULT 'variant'
//      — All existing branches are variants; the DEFAULT handles the backfill.
//   2. source_branch_id uuid REFERENCES resume_branches(id)
//      — The variant a translation or revision is attached to. NULL for variants.
//   3. source_commit_id uuid REFERENCES resume_commits(id)
//      — Mutable "caught-up pointer" for translations; immutable fork point for revisions.
//   4. CHECK branch_type_check  — restricts to the three known types.
//   5. CHECK branch_source_check — enforces that source_branch_id is set iff type ≠ variant.
//   6. Partial index on source_branch_id — efficient lookup of child branches.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_branches")
    .addColumn("branch_type", "varchar(16)", (col) =>
      col.notNull().defaultTo("variant"),
    )
    .addColumn("source_branch_id", "uuid", (col) =>
      col.references("resume_branches.id").onDelete("restrict"),
    )
    .addColumn("source_commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("restrict"),
    )
    .execute();

  await sql`
    ALTER TABLE resume_branches
    ADD CONSTRAINT branch_type_check
    CHECK (branch_type IN ('variant', 'translation', 'revision'))
  `.execute(db);

  await sql`
    ALTER TABLE resume_branches
    ADD CONSTRAINT branch_source_check
    CHECK (
      (branch_type = 'variant' AND source_branch_id IS NULL)
      OR
      (branch_type IN ('translation', 'revision') AND source_branch_id IS NOT NULL)
    )
  `.execute(db);

  await sql`
    CREATE INDEX idx_resume_branches_source_branch_id
    ON resume_branches(source_branch_id)
    WHERE source_branch_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS idx_resume_branches_source_branch_id
  `.execute(db);

  await sql`
    ALTER TABLE resume_branches
    DROP CONSTRAINT IF EXISTS branch_source_check
  `.execute(db);

  await sql`
    ALTER TABLE resume_branches
    DROP CONSTRAINT IF EXISTS branch_type_check
  `.execute(db);

  await db.schema
    .alterTable("resume_branches")
    .dropColumn("source_commit_id")
    .dropColumn("source_branch_id")
    .dropColumn("branch_type")
    .execute();
}
