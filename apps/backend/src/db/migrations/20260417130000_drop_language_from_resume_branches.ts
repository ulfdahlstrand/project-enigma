import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("resume_branches").dropColumn("language").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_branches")
    .addColumn("language", "varchar", (col) => col.notNull().defaultTo("en"))
    .execute();
}
