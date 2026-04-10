import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .dropColumn("google_sub")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("google_sub", "varchar(255)", (col) => col.notNull().defaultTo(""))
    .execute();

  await db.schema
    .createIndex("users_google_sub_unique")
    .on("users")
    .column("google_sub")
    .unique()
    .execute();
}
