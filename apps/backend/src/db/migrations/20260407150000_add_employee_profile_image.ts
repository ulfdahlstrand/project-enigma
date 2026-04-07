import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("employees")
    .addColumn("profile_image_data_url", "text")
    .addColumn("profile_image_original_data_url", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("employees")
    .dropColumn("profile_image_original_data_url")
    .dropColumn("profile_image_data_url")
    .execute();
}
