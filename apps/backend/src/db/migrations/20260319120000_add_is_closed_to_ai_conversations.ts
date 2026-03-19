import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_is_closed_to_ai_conversations
//
// Adds is_closed to allow distinguishing paused conversations (drawer closed)
// from deliberately ended ones (user started fresh or discarded).
// Paused conversations are resumed automatically when the panel is reopened
// for the same entity.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .addColumn("is_closed", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .createIndex("idx_ai_conversations_is_closed")
    .on("ai_conversations")
    .column("is_closed")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("is_closed")
    .execute();
}
