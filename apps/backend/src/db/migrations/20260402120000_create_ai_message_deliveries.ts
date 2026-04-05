import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("ai_message_deliveries")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("conversation_id", "uuid", (col) =>
      col.notNull().references("ai_conversations.id").onDelete("cascade")
    )
    .addColumn("ai_message_id", "uuid", (col) =>
      col.references("ai_messages.id").onDelete("set null")
    )
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("role", "text")
    .addColumn("content", "text")
    .addColumn("tool_name", "text")
    .addColumn("payload", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();

  await db.schema
    .alterTable("ai_message_deliveries")
    .addCheckConstraint(
      "ai_message_deliveries_kind_check",
      sql`kind IN ('visible_message', 'internal_message', 'tool_call', 'tool_result')`
    )
    .execute();

  await db.schema
    .createIndex("idx_ai_message_deliveries_conversation_id")
    .on("ai_message_deliveries")
    .column("conversation_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_message_deliveries_ai_message_id")
    .on("ai_message_deliveries")
    .column("ai_message_id")
    .execute();

  await db.schema
    .createIndex("idx_ai_message_deliveries_created_at")
    .on("ai_message_deliveries")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("ai_message_deliveries").execute();
}
