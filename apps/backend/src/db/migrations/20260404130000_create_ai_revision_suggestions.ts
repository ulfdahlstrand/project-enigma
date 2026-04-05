import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("ai_revision_suggestions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("conversation_id", "uuid", (col) =>
      col.notNull().references("ai_conversations.id").onDelete("cascade")
    )
    .addColumn("branch_id", "uuid", (col) =>
      col.notNull().references("resume_branches.id").onDelete("cascade")
    )
    .addColumn("work_item_id", "text")
    .addColumn("suggestion_id", "text", (col) => col.notNull())
    .addColumn("summary", "text")
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("section", "text", (col) => col.notNull())
    .addColumn("assignment_id", "uuid", (col) =>
      col.references("assignments.id").onDelete("set null")
    )
    .addColumn("suggested_text", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("skills", "jsonb")
    .addColumn("skill_scope", "jsonb")
    .addColumn("payload", "jsonb")
    .addColumn("resolved_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .alterTable("ai_revision_suggestions")
    .addCheckConstraint(
      "ai_revision_suggestions_status_check",
      sql`status IN ('pending', 'accepted', 'dismissed', 'applied')`
    )
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_suggestions_conversation_id")
    .on("ai_revision_suggestions")
    .column("conversation_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_suggestions_branch_id")
    .on("ai_revision_suggestions")
    .column("branch_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_suggestions_status")
    .on("ai_revision_suggestions")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_ai_revision_suggestions_conversation_suggestion")
    .on("ai_revision_suggestions")
    .columns(["conversation_id", "suggestion_id"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("ai_revision_suggestions").execute();
}
