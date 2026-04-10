import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_revision_assignment")
    .addColumn("keywords", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_revision_assignment")
    .dropColumn("keywords")
    .execute();
}
