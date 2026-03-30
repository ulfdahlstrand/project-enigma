import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    drop index if exists resume_revision_workflows_active_resume_branch_uidx
  `.execute(db);

  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .dropConstraint("resume_revision_workflow_steps_approved_message_id_fkey")
    .ifExists()
    .execute();

  await db.schema.dropTable("resume_revision_messages").ifExists().execute();
  await db.schema.dropTable("resume_revision_workflow_steps").ifExists().execute();
  await db.schema.dropTable("resume_revision_workflows").ifExists().execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resume_revision_workflows")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("resume_id", "uuid", (col) =>
      col.notNull().references("resumes.id").onDelete("cascade")
    )
    .addColumn("base_branch_id", "uuid", (col) =>
      col.notNull().references("resume_branches.id").onDelete("restrict")
    )
    .addColumn("revision_branch_id", "uuid", (col) =>
      col.references("resume_branches.id").onDelete("set null")
    )
    .addColumn("created_by", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("restrict")
    )
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("resume_revision_workflows_resume_id_idx")
    .on("resume_revision_workflows")
    .column("resume_id")
    .execute();

  await db.schema
    .createTable("resume_revision_workflow_steps")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("workflow_id", "uuid", (col) =>
      col.notNull().references("resume_revision_workflows.id").onDelete("cascade")
    )
    .addColumn("section", "text", (col) => col.notNull())
    .addColumn("section_detail", "text")
    .addColumn("step_order", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("approved_message_id", "uuid")
    .addColumn("commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("resume_revision_workflow_steps_workflow_id_idx")
    .on("resume_revision_workflow_steps")
    .column("workflow_id")
    .execute();

  await db.schema
    .createTable("resume_revision_messages")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("step_id", "uuid", (col) =>
      col.notNull().references("resume_revision_workflow_steps.id").onDelete("cascade")
    )
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("message_type", "text", (col) => col.notNull().defaultTo("text"))
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("structured_content", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("resume_revision_messages_step_id_idx")
    .on("resume_revision_messages")
    .column("step_id")
    .execute();

  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .addForeignKeyConstraint(
      "resume_revision_workflow_steps_approved_message_id_fkey",
      ["approved_message_id"],
      "resume_revision_messages",
      ["id"],
    )
    .onDelete("set null")
    .execute();

  await sql`
    create unique index if not exists resume_revision_workflows_active_resume_branch_uidx
    on resume_revision_workflows (resume_id, base_branch_id)
    where status = 'active'
  `.execute(db);
}
