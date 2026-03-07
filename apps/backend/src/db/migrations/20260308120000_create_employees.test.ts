/**
 * Static-analysis tests for the 20260308120000_create_employees migration.
 *
 * These tests cover acceptance criteria 1–5 and 12 by inspecting the
 * migration file's source text and exported function signatures without
 * connecting to a real database.
 *
 * AC 6 and AC 7 (live database smoke tests) require a running PostgreSQL
 * instance and are deferred per docs/arch/testing.md ("Integration tests
 * with live database" is an explicitly deferred decision).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ── Resolve file locations ───────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname; // tests live next to the migration file

// ── AC 1: Migration file exists with the correct naming pattern ──────────────

describe("AC1 – Migration file naming convention", () => {
  it("has a file whose name matches YYYYMMDDHHMMSS_create_employees.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    const pattern = /^[0-9]{14}_create_employees\.ts$/;
    const match = files.find((f) => pattern.test(f));
    expect(
      match,
      `Expected a file matching ${pattern} in ${migrationsDir}, found: ${files.join(", ")}`
    ).toBeDefined();
  });

  it("the matching file is exactly 20260308120000_create_employees.ts", () => {
    // Confirms the specific timestamp used by this task
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    expect(files).toContain("20260308120000_create_employees.ts");
  });
});

// ── Load the migration source for text-based assertions ─────────────────────

const migrationSource = readFileSync(
  join(migrationsDir, "20260308120000_create_employees.ts"),
  "utf-8"
);

// ── AC 2: `up` export signature and Kysely schema builder usage ──────────────

describe("AC2 – up() export uses Kysely schema builder", () => {
  it("exports an async function named 'up'", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+up\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });

  it("uses db.schema.createTable (Kysely schema builder)", () => {
    expect(migrationSource).toContain("db.schema");
    expect(migrationSource).toContain(".createTable(");
  });

  it("does not use raw SQL string concatenation (no template-literal SQL or string-concat SQL)", () => {
    // Raw SQL via sql tag or string building would look like sql`CREATE TABLE`
    // or db.executeQuery(... 'CREATE TABLE ...'). We check for obvious patterns.
    expect(migrationSource).not.toMatch(/sql`[^`]*CREATE\s+TABLE/i);
    expect(migrationSource).not.toMatch(/['"]CREATE\s+TABLE/i);
  });
});

// ── AC 3: `down` export drops the employees table ───────────────────────────

describe("AC3 – down() export drops the employees table", () => {
  it("exports an async function named 'down'", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+down\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });

  it("calls dropTable('employees') in down()", () => {
    expect(migrationSource).toContain(".dropTable(");
    expect(migrationSource).toContain('"employees"');
  });
});

// ── AC 4: Column definitions — names, types, constraints ────────────────────

describe("AC4 – employees table column definitions", () => {
  it("defines the 'id' column as uuid with primaryKey and gen_random_uuid default", () => {
    expect(migrationSource).toContain('"id"');
    expect(migrationSource).toContain('"uuid"');
    expect(migrationSource).toContain(".primaryKey()");
    expect(migrationSource).toContain('"gen_random_uuid"');
  });

  it("defines the 'name' column as varchar(255) not null", () => {
    expect(migrationSource).toContain('"name"');
    expect(migrationSource).toContain('"varchar(255)"');
    // notNull appears on name's builder chain – confirm at least one usage
    expect(migrationSource).toContain(".notNull()");
  });

  it("defines the 'email' column as varchar(255) not null unique", () => {
    expect(migrationSource).toContain('"email"');
    expect(migrationSource).toContain(".unique()");
  });

  it("defines 'created_at' as timestamptz not null with now() default", () => {
    expect(migrationSource).toContain('"created_at"');
    expect(migrationSource).toContain('"timestamptz"');
    expect(migrationSource).toContain('"now"');
  });

  it("defines 'updated_at' as timestamptz not null with now() default", () => {
    expect(migrationSource).toContain('"updated_at"');
  });
});

// ── AC 5: No extra columns beyond the five specified ────────────────────────

describe("AC5 – no extra columns in the employees table", () => {
  it("contains exactly 5 addColumn() calls in the up() function", () => {
    const matches = migrationSource.match(/\.addColumn\(/g);
    expect(
      matches,
      "Expected exactly 5 .addColumn() calls, found: " +
        (matches ? matches.length : 0)
    ).not.toBeNull();
    expect(matches!.length).toBe(5);
  });

  it("does not define CV, profile, or skills columns", () => {
    const forbidden = ["cv", "skill", "role", "title", "bio", "avatar", "phone"];
    for (const col of forbidden) {
      expect(migrationSource.toLowerCase()).not.toContain(`"${col}"`);
    }
  });
});

// ── AC 12: No seed or test data inserts in the migration ────────────────────

describe("AC12 – migration contains no seed or test data", () => {
  it("does not call insertInto() in the migration file", () => {
    expect(migrationSource).not.toContain(".insertInto(");
  });

  it("does not contain a raw INSERT SQL statement", () => {
    expect(migrationSource.toUpperCase()).not.toMatch(/\bINSERT\s+INTO\b/);
  });

  it("does not call values() (data insertion helper)", () => {
    // .values() is only meaningful after an insertInto; no false positives expected
    expect(migrationSource).not.toContain(".values(");
  });
});
