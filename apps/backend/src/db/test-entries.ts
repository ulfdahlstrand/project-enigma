import postgres from "postgres";
import type { TestEntry } from "@cv-tool/contracts";

/**
 * Lazy singleton PostgreSQL client.
 *
 * The connection string is read from the DATABASE_URL environment variable at
 * the time the first query is made, not at module load time. This avoids
 * connection errors during tests that do not exercise DB code.
 */
let sql: ReturnType<typeof postgres> | undefined;

function getClient(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error(
        "[backend] DATABASE_URL environment variable is not set. " +
          "Cannot connect to PostgreSQL."
      );
    }
    sql = postgres(url);
  }
  return sql;
}

/**
 * Queries all rows from the `test_entries` table.
 *
 * This table is created and seeded by the initial migration
 * (packages/database/migrations/20260304000000_create_test_entries.sql).
 */
export async function queryTestEntries(): Promise<TestEntry[]> {
  const client = getClient();
  const rows = await client<TestEntry[]>`
    SELECT id, name, note
    FROM test_entries
    ORDER BY id ASC
  `;
  return rows;
}
