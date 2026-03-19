import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Migration: create_user_sessions
//
// Records one row per login event. Used for:
//   - Security auditing (who logged in, when, from where)
//   - Refresh token storage (hashed token, expiry, revocation)
// ---------------------------------------------------------------------------

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_sessions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(db.fn("gen_random_uuid", []))
    )
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("ip_address", "text")
    .addColumn("user_agent", "text")
    .addColumn("logged_in_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("last_seen_at", "timestamptz", (col) =>
      col.notNull().defaultTo(db.fn("now", []))
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("refresh_token_hash", "text")
    .addColumn("revoked_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("user_sessions_user_id_idx")
    .on("user_sessions")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("user_sessions_refresh_token_hash_idx")
    .on("user_sessions")
    .column("refresh_token_hash")
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("user_sessions").execute();
}
