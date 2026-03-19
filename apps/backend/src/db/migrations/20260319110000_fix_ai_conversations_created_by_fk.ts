import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: fix_ai_conversations_created_by_fk
//
// The initial migration incorrectly referenced employees.id for created_by.
// Auth context provides users.id (from the users table), so the FK must
// point to users.id — matching the pattern used by resume_commits and
// resume_branches.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropConstraint("ai_conversations_created_by_fkey")
    .execute();

  await db.schema
    .alterTable("ai_conversations")
    .addForeignKeyConstraint(
      "ai_conversations_created_by_fkey",
      ["created_by"],
      "users",
      ["id"]
    )
    .onDelete("cascade")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("ai_conversations")
    .dropConstraint("ai_conversations_created_by_fkey")
    .execute();

  await db.schema
    .alterTable("ai_conversations")
    .addForeignKeyConstraint(
      "ai_conversations_created_by_fkey",
      ["created_by"],
      "employees",
      ["id"]
    )
    .onDelete("cascade")
    .execute();
}
