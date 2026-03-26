import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create unique index if not exists resume_revision_workflows_active_resume_branch_uidx
    on resume_revision_workflows (resume_id, base_branch_id)
    where status = 'active'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index if exists resume_revision_workflows_active_resume_branch_uidx
  `.execute(db);
}
