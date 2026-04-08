import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_resume_branches
//
// Creates resume variants (analogous to git branches). Each branch is a named
// pointer to a HEAD commit, with an optional fork point for tracing history
// across variants.
//
// Historical note:
//   This migration also completed the old circular FK by adding a DEFERRABLE
//   FK from resume_commits.branch_id to resume_branches. That legacy commit
//   column is dropped by a later cleanup migration once branch refs and commit
//   ancestry live entirely in resume_branches + resume_commit_parents.
//
// This originally allowed inserting both rows in a single transaction
// (branch with NULL head_commit_id, then commit, then updating head_commit_id)
// without violating FK constraints mid-transaction.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_branches")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("language", "varchar(10)", (col) => col.notNull())
    .addColumn("is_main", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("head_commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .addColumn("forked_from_commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .addColumn("created_by", "uuid", (col) =>
      col.references("users.id").onDelete("set null")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createIndex("idx_resume_branches_resume_id")
    .on("resume_branches")
    .column("resume_id")
    .execute();

  await db.schema
    .createIndex("idx_resume_branches_head_commit_id")
    .on("resume_branches")
    .column("head_commit_id")
    .execute();

  // Partial index: fast lookup for the main branch per resume
  await sql`
    CREATE UNIQUE INDEX idx_resume_branches_one_main_per_resume
    ON resume_branches (resume_id)
    WHERE is_main = true
  `.execute(db);

  // Complete the original circular FK: resume_commits.branch_id → resume_branches
  // DEFERRABLE INITIALLY DEFERRED allows the insert pattern:
  //   BEGIN; INSERT branch (head=NULL); INSERT commit (branch_id=X);
  //   UPDATE branch SET head_commit_id=Y; COMMIT;
  await sql`
    ALTER TABLE resume_commits
    ADD CONSTRAINT fk_resume_commits_branch_id
    FOREIGN KEY (branch_id)
    REFERENCES resume_branches (id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE resume_commits DROP CONSTRAINT IF EXISTS fk_resume_commits_branch_id
  `.execute(db);
  await db.schema.dropTable("resume_branches").execute();
}
