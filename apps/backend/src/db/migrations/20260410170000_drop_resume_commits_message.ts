import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("resume_commits")
    .dropColumn("message")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("resume_commits")
    .addColumn("message", "text", (col) => col.notNull().defaultTo(""))
    .execute();

  await sql`UPDATE resume_commits SET message = title`.execute(db);
}
