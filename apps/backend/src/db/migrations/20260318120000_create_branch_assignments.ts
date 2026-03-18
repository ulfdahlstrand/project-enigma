import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_branch_assignments
//
// Per-branch assignment linking. Replaces the global assignments.resume_id
// scoping with a branch-level join table, allowing each resume variant to
// curate its own assignment list independently.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("branch_assignments")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("branch_id", "uuid", (col) =>
      col.notNull().references("resume_branches.id").onDelete("cascade")
    )
    .addColumn("assignment_id", "uuid", (col) =>
      col.notNull().references("assignments.id").onDelete("cascade")
    )
    .addColumn("highlight", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn("sort_order", "integer")
    .addUniqueConstraint("uq_branch_assignments_branch_assignment", [
      "branch_id",
      "assignment_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_branch_assignments_branch_id")
    .on("branch_assignments")
    .column("branch_id")
    .execute();

  await db.schema
    .createIndex("idx_branch_assignments_assignment_id")
    .on("branch_assignments")
    .column("assignment_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("branch_assignments").execute();
}
