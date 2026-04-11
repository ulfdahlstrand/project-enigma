import { sql, type Kysely } from "kysely";

const CLIENT_SEEDS = [
  {
    key: "anthropic_claude",
    title: "Anthropic Claude",
    description: "External Claude-based client using the public resume revision API.",
  },
  {
    key: "openai_chatgpt",
    title: "OpenAI ChatGPT",
    description: "External ChatGPT-based client using the public resume revision API.",
  },
  {
    key: "custom_mcp_client",
    title: "Custom MCP Client",
    description: "Custom external client integrating through the same public API surface.",
  },
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  const typedDb = db as Kysely<any>;

  await db.schema
    .createTable("external_ai_clients")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("key", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("external_ai_authorizations")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("client_id", "uuid", (col) =>
      col.notNull().references("external_ai_clients.id").onDelete("cascade"))
    .addColumn("title", "varchar(255)")
    .addColumn("scopes", sql`text[]`, (col) => col.notNull())
    .addColumn("status", "varchar(32)", (col) => col.notNull().defaultTo("pending"))
    .addColumn("last_used_at", "timestamptz")
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("external_ai_login_challenges")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("authorization_id", "uuid", (col) =>
      col.notNull().references("external_ai_authorizations.id").onDelete("cascade"))
    .addColumn("challenge_code_hash", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("used_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("external_ai_access_tokens")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("authorization_id", "uuid", (col) =>
      col.notNull().references("external_ai_authorizations.id").onDelete("cascade"))
    .addColumn("token_hash", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("scopes", sql`text[]`, (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_used_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("external_ai_authorizations_user_idx")
    .on("external_ai_authorizations")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("external_ai_access_tokens_authorization_idx")
    .on("external_ai_access_tokens")
    .column("authorization_id")
    .execute();

  await typedDb.insertInto("external_ai_clients").values(CLIENT_SEEDS).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("external_ai_access_tokens").ifExists().execute();
  await db.schema.dropTable("external_ai_login_challenges").ifExists().execute();
  await db.schema.dropTable("external_ai_authorizations").ifExists().execute();
  await db.schema.dropTable("external_ai_clients").ifExists().execute();
}
