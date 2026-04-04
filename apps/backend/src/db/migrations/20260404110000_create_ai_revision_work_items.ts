import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("ai_revision_work_items")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("conversation_id", "uuid", (col) =>
      col.notNull().references("ai_conversations.id").onDelete("cascade")
    )
    .addColumn("branch_id", "uuid", (col) =>
      col.notNull().references("resume_branches.id").onDelete("cascade")
    )
    .addColumn("work_item_id", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("section", "text", (col) => col.notNull())
    .addColumn("assignment_id", "uuid", (col) =>
      col.references("assignments.id").onDelete("set null")
    )
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("note", "text")
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("attempt_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("payload", "jsonb")
    .addColumn("completed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .alterTable("ai_revision_work_items")
    .addCheckConstraint(
      "ai_revision_work_items_status_check",
      sql`status IN ('pending', 'in_progress', 'completed', 'no_changes_needed', 'failed', 'blocked')`
    )
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_work_items_conversation_id")
    .on("ai_revision_work_items")
    .column("conversation_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_work_items_branch_id")
    .on("ai_revision_work_items")
    .column("branch_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_work_items_status")
    .on("ai_revision_work_items")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_work_items_conversation_work_item")
    .on("ai_revision_work_items")
    .columns(["conversation_id", "work_item_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("ai_revision_work_items").execute();
}
