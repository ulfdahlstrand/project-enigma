import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("external_ai_access_tokens")
    .addColumn("refresh_token_hash", "varchar(255)")
    .execute();

  await db.schema
    .createIndex("external_ai_access_tokens_refresh_token_hash_unique")
    .unique()
    .on("external_ai_access_tokens")
    .column("refresh_token_hash")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex("external_ai_access_tokens_refresh_token_hash_unique")
    .ifExists()
    .execute();

  await db.schema
    .alterTable("external_ai_access_tokens")
    .dropColumn("refresh_token_hash")
    .execute();
}
