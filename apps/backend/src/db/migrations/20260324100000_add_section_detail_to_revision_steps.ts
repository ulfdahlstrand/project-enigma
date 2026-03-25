import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .addColumn("section_detail", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .dropColumn("section_detail")
    .execute();
}
