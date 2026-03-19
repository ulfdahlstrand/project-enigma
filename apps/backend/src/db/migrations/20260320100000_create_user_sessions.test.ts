/**
 * Static-analysis tests for the 20260320100000_create_user_sessions migration.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrationSource = readFileSync(
  join(__dirname, "20260320100000_create_user_sessions.ts"),
  "utf-8"
);

describe("create_user_sessions migration — file naming", () => {
  it("file exists with correct naming pattern", () => {
    const files = readdirSync(__dirname).filter((f) => !f.endsWith(".test.ts"));
    expect(files).toContain("20260320100000_create_user_sessions.ts");
  });
});

describe("create_user_sessions migration — up()", () => {
  it("exports an async up function", () => {
    expect(migrationSource).toMatch(/export\s+async\s+function\s+up/);
  });

  it("creates the user_sessions table", () => {
    expect(migrationSource).toContain('"user_sessions"');
    expect(migrationSource).toContain(".createTable(");
  });

  it("defines required columns", () => {
    const required = ["id", "user_id", "expires_at", "logged_in_at", "last_seen_at"];
    for (const col of required) {
      expect(migrationSource).toContain(`"${col}"`);
    }
  });

  it("defines nullable columns for optional data", () => {
    const nullable = ["ip_address", "user_agent", "refresh_token_hash", "revoked_at"];
    for (const col of nullable) {
      expect(migrationSource).toContain(`"${col}"`);
    }
  });

  it("references users.id with ON DELETE CASCADE", () => {
    expect(migrationSource).toContain('"users.id"');
    expect(migrationSource).toContain(".onDelete(\"cascade\")");
  });

  it("creates an index on user_id", () => {
    expect(migrationSource).toContain("user_sessions_user_id_idx");
  });

  it("creates a unique index on refresh_token_hash", () => {
    expect(migrationSource).toContain("user_sessions_refresh_token_hash_idx");
    expect(migrationSource).toContain(".unique()");
  });
});

describe("create_user_sessions migration — down()", () => {
  it("exports an async down function", () => {
    expect(migrationSource).toMatch(/export\s+async\s+function\s+down/);
  });

  it("drops the user_sessions table", () => {
    expect(migrationSource).toContain(".dropTable(");
    expect(migrationSource).toContain('"user_sessions"');
  });
});

describe("create_user_sessions migration — no seed data", () => {
  it("does not insert any rows", () => {
    expect(migrationSource).not.toContain(".insertInto(");
    expect(migrationSource.toUpperCase()).not.toMatch(/\bINSERT\s+INTO\b/);
  });
});
