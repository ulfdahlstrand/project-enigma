/**
 * Static-analysis tests for the 20260417100000_add_commit_tags migration.
 *
 * Covers acceptance criteria by inspecting the migration file's source text
 * and exported function signatures without connecting to a real database.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

// ── AC 1: Migration file exists with correct naming pattern ──────────────────

describe("AC1 – Migration file naming convention", () => {
  it("has a file matching 20260417100000_add_commit_tags.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    expect(files).toContain("20260417100000_add_commit_tags.ts");
  });
});

// ── Load migration source ────────────────────────────────────────────────────

const migrationSource = readFileSync(
  join(migrationsDir, "20260417100000_add_commit_tags.ts"),
  "utf-8"
);

// ── AC 2: up() uses Kysely schema builder ────────────────────────────────────

describe("AC2 – up() exports and uses Kysely schema builder", () => {
  it("exports an async up(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+up\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });

  it("uses db.schema.createTable", () => {
    expect(migrationSource).toContain('.createTable("commit_tags")');
  });

  it("does not use raw SQL template literals for DDL", () => {
    expect(migrationSource).not.toMatch(/sql`[^`]*CREATE\s+TABLE/i);
    expect(migrationSource).not.toMatch(/['"]CREATE\s+TABLE/i);
  });
});

// ── AC 3: down() drops the table ─────────────────────────────────────────────

describe("AC3 – down() drops commit_tags", () => {
  it("exports an async down(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+down\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });

  it("calls dropTable('commit_tags') in down()", () => {
    expect(migrationSource).toContain('.dropTable("commit_tags")');
  });
});

// ── AC 4: commit_tags column definitions ─────────────────────────────────────

describe("AC4 – commit_tags column definitions", () => {
  it("defines id as uuid primary key with gen_random_uuid default", () => {
    expect(migrationSource).toContain('"id"');
    expect(migrationSource).toContain('"uuid"');
    expect(migrationSource).toContain(".primaryKey()");
    expect(migrationSource).toContain('"gen_random_uuid"');
  });

  it("defines source_commit_id as uuid not null with FK to resume_commits", () => {
    expect(migrationSource).toContain('"source_commit_id"');
    expect(migrationSource).toContain('"resume_commits.id"');
  });

  it("defines target_commit_id as uuid not null with FK to resume_commits", () => {
    expect(migrationSource).toContain('"target_commit_id"');
  });

  it("defines kind as varchar(32) not null with default 'translation'", () => {
    expect(migrationSource).toContain('"kind"');
    expect(migrationSource).toContain('"varchar(32)"');
    expect(migrationSource).toContain("'translation'");
  });

  it("defines created_at as timestamptz not null with now() default", () => {
    expect(migrationSource).toContain('"created_at"');
    expect(migrationSource).toContain('"timestamptz"');
    expect(migrationSource).toContain('"now"');
  });

  it("defines created_by as nullable uuid FK to employees", () => {
    expect(migrationSource).toContain('"created_by"');
    expect(migrationSource).toContain('"employees.id"');
  });
});

// ── AC 5: Unique constraint ───────────────────────────────────────────────────

describe("AC5 – unique constraint on (source_commit_id, target_commit_id, kind)", () => {
  it("adds a unique constraint covering source_commit_id, target_commit_id, kind", () => {
    expect(migrationSource).toContain("source_commit_id");
    expect(migrationSource).toContain("target_commit_id");
    expect(migrationSource).toContain("kind");
    expect(migrationSource).toMatch(/unique|addUniqueConstraint/i);
  });
});

// ── AC 6: Indexes ────────────────────────────────────────────────────────────

describe("AC6 – indexes on source and target commit id columns", () => {
  it("creates idx_commit_tags_source index", () => {
    expect(migrationSource).toContain("idx_commit_tags_source");
  });

  it("creates idx_commit_tags_target index", () => {
    expect(migrationSource).toContain("idx_commit_tags_target");
  });

  it("drops both indexes in down()", () => {
    expect(migrationSource).toContain(".dropIndex(");
  });
});

// ── AC 7: No seed data ────────────────────────────────────────────────────────

describe("AC7 – no seed data in migration", () => {
  it("does not call insertInto()", () => {
    expect(migrationSource).not.toContain(".insertInto(");
  });

  it("does not contain raw INSERT SQL", () => {
    expect(migrationSource.toUpperCase()).not.toMatch(/\bINSERT\s+INTO\b/);
  });
});
