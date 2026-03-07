import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely";
import { getDb } from "./client.js";

// ---------------------------------------------------------------------------
// Migration runner CLI
//
// Runs all pending Kysely migrations to bring the database schema up to date.
// Usage: npm run migrate -w apps/backend
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = getDb();

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, "migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

if (results) {
  for (const result of results) {
    if (result.status === "Success") {
      console.log(`[migrate] Applied: ${result.migrationName}`);
    } else if (result.status === "Error") {
      console.error(`[migrate] Failed: ${result.migrationName}`);
    }
  }
}

if (error) {
  console.error("[migrate] Migration failed:", error);
  process.exit(1);
}

if (!results || results.length === 0) {
  console.log("[migrate] No pending migrations.");
}

await db.destroy();
