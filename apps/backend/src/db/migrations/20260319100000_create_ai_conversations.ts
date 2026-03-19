import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_ai_conversations
//
// Creates two tables for the AI assistant chat feature:
//   - ai_conversations: one row per chat session, scoped to an entity
//     (e.g. an assignment or resume) via entity_type + entity_id.
//   - ai_messages: the individual turns (user / assistant) within a session.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("ai_conversations")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("created_by", "uuid", (col) =>
      col.notNull().references("employees.id").onDelete("cascade")
    )
    .addColumn("entity_type", "text", (col) => col.notNull())
    .addColumn("entity_id", "uuid", (col) => col.notNull())
    .addColumn("system_prompt", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .createTable("ai_messages")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("conversation_id", "uuid", (col) =>
      col.notNull().references("ai_conversations.id").onDelete("cascade")
    )
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  // Constraint: role must be 'user' or 'assistant'
  await db.schema
    .alterTable("ai_messages")
    .addCheckConstraint("ai_messages_role_check", sql`role IN ('user', 'assistant')`)
    .execute();

  await db.schema
    .createIndex("idx_ai_conversations_created_by")
    .on("ai_conversations")
    .column("created_by")
    .execute();

  await db.schema
    .createIndex("idx_ai_conversations_entity")
    .on("ai_conversations")
    .columns(["entity_type", "entity_id"])
    .execute();

  await db.schema
    .createIndex("idx_ai_conversations_updated_at")
    .on("ai_conversations")
    .column("updated_at")
    .execute();

  await db.schema
    .createIndex("idx_ai_messages_conversation_id")
    .on("ai_messages")
    .column("conversation_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_messages_created_at")
    .on("ai_messages")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("ai_messages").execute();
  await db.schema.dropTable("ai_conversations").execute();
}
