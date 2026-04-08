/**
 * Static-analysis tests for the 20260326143000_create_resume_commit_parents migration.
 *
 * Covers the table structure, indexes, and backfill included in up().
 * Live database integration tests are deferred per docs/arch/testing.md.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

// ── AC 1: File naming ────────────────────────────────────────────────────────

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_create_resume_commit_parents.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    const pattern = /^[0-9]{14}_create_resume_commit_parents\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260326143000_create_resume_commit_parents.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    expect(files).toContain("20260326143000_create_resume_commit_parents.ts");
  });
});

const migrationSource = readFileSync(
  join(migrationsDir, "20260326143000_create_resume_commit_parents.ts"),
  "utf-8"
);

// ── AC 2: up() / down() exports ───────────────────────────────────────────────

describe("AC2 – up() and down() exports", () => {
  it("exports async function up(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+up\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });

  it("exports async function down(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+down\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/
    );
  });
});

// ── AC 3: Table creation ─────────────────────────────────────────────────────

describe("AC3 – resume_commit_parents table structure", () => {
  it("creates resume_commit_parents table", () => {
    expect(migrationSource).toContain('"resume_commit_parents"');
    expect(migrationSource).toContain(".createTable(");
  });

  it("defines commit_id column", () => {
    expect(migrationSource).toContain('"commit_id"');
  });

  it("defines parent_commit_id column", () => {
    expect(migrationSource).toContain('"parent_commit_id"');
  });

  it("defines parent_order column as integer", () => {
    expect(migrationSource).toContain('"parent_order"');
    expect(migrationSource).toContain('"integer"');
  });

  it("references resume_commits.id for foreign keys", () => {
    expect(migrationSource).toContain('"resume_commits.id"');
  });

  it("uses ON DELETE CASCADE for both FK columns", () => {
    const cascadeCount = (migrationSource.match(/onDelete\("cascade"\)/g) ?? []).length;
    expect(cascadeCount).toBeGreaterThanOrEqual(2);
  });
});

// ── AC 4: Indexes ─────────────────────────────────────────────────────────────

describe("AC4 – Indexes for graph traversal", () => {
  it("creates idx_resume_commit_parents_parent_commit_id", () => {
    expect(migrationSource).toContain("idx_resume_commit_parents_parent_commit_id");
  });

  it("creates idx_resume_commit_parents_commit_id", () => {
    expect(migrationSource).toContain("idx_resume_commit_parents_commit_id");
  });
});

// ── AC 5: Backfill from resume_commits.parent_commit_id ──────────────────────

describe("AC5 – Backfill in up()", () => {
  it("inserts from resume_commits where parent_commit_id is not null", () => {
    expect(migrationSource).toContain("resume_commits");
    expect(migrationSource).toMatch(/parent_commit_id\s+is\s+not\s+null/i);
  });

  it("sets parent_order to 0 for linear parents", () => {
    expect(migrationSource).toContain(", 0");
  });
});

// ── AC 6: down() reverses the migration ───────────────────────────────────────

describe("AC6 – down() drops the table", () => {
  it("drops resume_commit_parents in down()", () => {
    expect(migrationSource).toContain(".dropTable(");
    expect(migrationSource).toContain('"resume_commit_parents"');
  });
});
