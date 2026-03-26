import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_commit_parents")
    .addColumn("commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("parent_commit_id", "uuid", (col) =>
      col.notNull().references("resume_commits.id").onDelete("cascade")
    )
    .addColumn("parent_order", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint("resume_commit_parents_pkey", ["commit_id", "parent_order"])
    .execute();

  await db.schema
    .createIndex("idx_resume_commit_parents_parent_commit_id")
    .on("resume_commit_parents")
    .column("parent_commit_id")
    .execute();

  await db.schema
    .createIndex("idx_resume_commit_parents_commit_id")
    .on("resume_commit_parents")
    .column("commit_id")
    .execute();

  await sql`
    insert into resume_commit_parents (commit_id, parent_commit_id, parent_order)
    select id, parent_commit_id, 0
    from resume_commits
    where parent_commit_id is not null
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("resume_commit_parents").execute();
}
