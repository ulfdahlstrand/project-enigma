import type { Kysely } from "kysely";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Migration: add_resume_revision_workflow
//
// Introduces three tables for the guided AI-assisted resume revision workflow:
//
//   resume_revision_workflows       — one per revision run, linked to a resume
//                                     and a base branch. A dedicated revision
//                                     branch is created when the workflow starts.
//
//   resume_revision_workflow_steps  — one row per checklist section (discovery,
//                                     consultant_title, … consistency_polish).
//                                     Steps progress through:
//                                     pending → generating → reviewing →
//                                     approved | needs_rework.
//                                     approved_message_id points to the proposal
//                                     message the user accepted. commit_id points
//                                     to the commit written on approval.
//
//   resume_revision_messages        — conversation messages per step (user and
//                                     assistant turns), keyed by step_id.
//                                     message_type distinguishes plain 'text'
//                                     replies from 'proposal' messages.
//                                     structured_content (JSONB) holds the
//                                     proposal payload on proposal messages:
//                                     { originalContent, proposedContent,
//                                       reasoning, changeSummary }.
//
// There is no separate step_results table — the proposal IS a message in the
// thread. Approving a step records which message was accepted and which commit
// it produced, mirroring the GitHub issues model.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  // -- resume_revision_workflows ---------------------------------------------

  await db.schema
    .createTable("resume_revision_workflows")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
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
    .addColumn("status", "text", (col) =>
      col.notNull().defaultTo("active")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("resume_revision_workflows_resume_id_idx")
    .on("resume_revision_workflows")
    .column("resume_id")
    .execute();

  // -- resume_revision_workflow_steps ----------------------------------------

  await db.schema
    .createTable("resume_revision_workflow_steps")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("workflow_id", "uuid", (col) =>
      col.notNull().references("resume_revision_workflows.id").onDelete("cascade")
    )
    .addColumn("section", "text", (col) => col.notNull())
    .addColumn("step_order", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("approved_message_id", "uuid")
    .addColumn("commit_id", "uuid", (col) =>
      col.references("resume_commits.id").onDelete("set null")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("resume_revision_workflow_steps_workflow_id_idx")
    .on("resume_revision_workflow_steps")
    .column("workflow_id")
    .execute();

  // -- resume_revision_messages ----------------------------------------------

  await db.schema
    .createTable("resume_revision_messages")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("step_id", "uuid", (col) =>
      col.notNull().references("resume_revision_workflow_steps.id").onDelete("cascade")
    )
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("message_type", "text", (col) =>
      col.notNull().defaultTo("text")
    )
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("structured_content", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("resume_revision_messages_step_id_idx")
    .on("resume_revision_messages")
    .column("step_id")
    .execute();

  // Add FK from steps → messages now that messages table exists
  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .addForeignKeyConstraint(
      "resume_revision_workflow_steps_approved_message_id_fkey",
      ["approved_message_id"],
      "resume_revision_messages",
      ["id"]
    )
    .onDelete("set null")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resume_revision_workflow_steps")
    .dropConstraint("resume_revision_workflow_steps_approved_message_id_fkey")
    .execute();
  await db.schema.dropTable("resume_revision_messages").execute();
  await db.schema.dropTable("resume_revision_workflow_steps").execute();
  await db.schema.dropTable("resume_revision_workflows").execute();
}
