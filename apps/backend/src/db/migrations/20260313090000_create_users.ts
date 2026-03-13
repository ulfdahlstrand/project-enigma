import { sql, type Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_users
//
// Creates the `users` table for storing authenticated Google OAuth users.
// Each user is uniquely identified by their Google subject ID (google_sub).
// The role column controls access level within the application.
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType("user_role")
    .asEnum(["admin", "consultant"])
    .execute();

  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("google_sub", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("email", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("role", sql`user_role`, (col) =>
      col.notNull().defaultTo("consultant")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("users").execute();
  await db.schema.dropType("user_role").execute();
}
