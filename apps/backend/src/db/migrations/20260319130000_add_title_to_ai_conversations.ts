import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .addColumn("title", "varchar(255)")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropColumn("title")
    .execute();
}
