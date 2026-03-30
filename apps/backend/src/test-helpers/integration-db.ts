import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createDbFromConnectionString } from "../db/client.js";

const MIGRATION_TABLES = new Set(["kysely_migration", "kysely_migration_lock"]);

function ensureBackendEnvLoaded() {
  if (process.env["DATABASE_URL"]) {
    return;
  }

  const envPath = resolve(process.cwd(), ".env");
  const envContents = readFileSync(envPath, "utf8");

  for (const line of envContents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/gu, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function createIntegrationTestDb(connectionString = process.env["DATABASE_URL"]): Kysely<Database> {
  ensureBackendEnvLoaded();

  const resolvedConnectionString = connectionString ?? process.env["DATABASE_URL"];

  if (!resolvedConnectionString) {
    throw new Error(
      "[backend] DATABASE_URL environment variable is not set. " +
        "Cannot create integration test database."
    );
  }

  return createDbFromConnectionString(resolvedConnectionString);
}

export async function truncateAllPublicTables(db: Kysely<Database>) {
  const rows = await sql<{ tablename: string }>`
    select tablename
    from pg_tables
    where schemaname = 'public'
  `.execute(db);

  const tableNames = rows.rows
    .map((row) => row.tablename)
    .filter((name) => !MIGRATION_TABLES.has(name));

  if (tableNames.length === 0) {
    return;
  }

  const quotedTables = tableNames.map((name) => `"public"."${name}"`).join(", ");
  await sql.raw(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`).execute(db);
}
