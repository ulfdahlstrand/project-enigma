import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .addColumn("pending_decision", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("pending_decision")
    .execute();
}
