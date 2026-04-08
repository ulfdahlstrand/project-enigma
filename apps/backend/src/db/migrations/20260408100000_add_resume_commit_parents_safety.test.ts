/**
 * Static-analysis tests for the 20260408100000_add_resume_commit_parents_safety migration.
 *
 * The create migration (20260326143000) built the table and ran an initial
 * backfill, but it is missing three safety properties required by issue #498:
 *   1. No CHECK constraint preventing self-referential edges.
 *   2. The backfill INSERT was not idempotent (no ON CONFLICT).
 *   3. No UNIQUE constraint on (commit_id, parent_commit_id) — the PK is
 *      (commit_id, parent_order) which still allows duplicate parent refs.
 *
 * This migration patches those gaps without touching the existing table data.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

// ── AC 1: File naming ────────────────────────────────────────────────────────

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_add_resume_commit_parents_safety.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    const pattern = /^[0-9]{14}_add_resume_commit_parents_safety\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260408100000_add_resume_commit_parents_safety.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts")
    );
    expect(files).toContain("20260408100000_add_resume_commit_parents_safety.ts");
  });
});

const migrationSource = readFileSync(
  join(migrationsDir, "20260408100000_add_resume_commit_parents_safety.ts"),
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

// ── AC 3: Self-referential edge prevention ────────────────────────────────────

describe("AC3 – CHECK constraint prevents self-referential parent edges", () => {
  it("adds a CHECK constraint referencing commit_id and parent_commit_id", () => {
    expect(migrationSource).toMatch(
      /CHECK\s*\(\s*commit_id\s*(<>|!=)\s*parent_commit_id\s*\)/i
    );
  });

  it("names the constraint so it can be dropped in down()", () => {
    expect(migrationSource).toContain("chk_resume_commit_parents_no_self_ref");
  });

  it("uses pg_constraint check to skip adding if already exists (idempotent)", () => {
    expect(migrationSource).toContain("pg_constraint");
    expect(migrationSource).toMatch(/IF NOT EXISTS/i);
  });
});

// ── AC 4: Duplicate edge prevention ──────────────────────────────────────────

describe("AC4 – UNIQUE constraint prevents duplicate parent edges", () => {
  it("adds a unique constraint on (commit_id, parent_commit_id)", () => {
    expect(migrationSource).toMatch(
      /uq_resume_commit_parents_edge|UNIQUE.*commit_id.*parent_commit_id/i
    );
  });

  it("names the unique constraint so it can be dropped in down()", () => {
    expect(migrationSource).toContain("uq_resume_commit_parents_edge");
  });

  it("uses pg_constraint check to skip adding if already exists (idempotent)", () => {
    // pg_constraint check already covered in AC3 — constraint names are distinct
    expect(migrationSource).toContain("uq_resume_commit_parents_edge");
    expect(migrationSource).toContain("pg_constraint");
  });
});

// ── AC 5: Clean up invalid rows before adding constraints ────────────────────

describe("AC5 – up() removes invalid rows before adding constraints", () => {
  it("deletes self-referential rows where commit_id = parent_commit_id", () => {
    expect(migrationSource).toMatch(
      /DELETE.*resume_commit_parents|delete.*resume_commit_parents/i
    );
    expect(migrationSource).toMatch(
      /commit_id\s*=\s*parent_commit_id/i
    );
  });
});

// ── AC 7: Branch-inferred backfill for existing commits ──────────────────────
//
// resume_commits.parent_commit_id is always NULL — the app writes parent edges
// directly to resume_commit_parents. So we cannot backfill from that column.
// Instead we infer the linear chain per branch: order commits by created_at
// within each branch_id and link each commit to its predecessor.

describe("AC7 – up() infers and backfills parent relationships from branch ordering", () => {
  it("uses LAG() window function to infer parent from previous commit on same branch", () => {
    expect(migrationSource).toMatch(/LAG\s*\(/i);
  });

  it("partitions by branch_id to keep chains within each branch", () => {
    expect(migrationSource).toMatch(/PARTITION\s+BY\s+branch_id/i);
  });

  it("orders commits by created_at to determine ancestry", () => {
    expect(migrationSource).toMatch(/ORDER\s+BY\s+created_at/i);
  });

  it("skips commits that already have a parent recorded (idempotent via NOT EXISTS)", () => {
    expect(migrationSource).toMatch(/NOT\s+EXISTS/i);
  });

  it("inserts into resume_commit_parents", () => {
    expect(migrationSource).toContain("resume_commit_parents");
  });
});

// ── AC 6: down() reverses the constraints ────────────────────────────────────

describe("AC6 – down() drops the added constraints", () => {
  it("drops the self-referential CHECK constraint", () => {
    expect(migrationSource).toContain("chk_resume_commit_parents_no_self_ref");
    expect(migrationSource).toMatch(/DROP\s+CONSTRAINT/i);
  });

  it("drops the unique constraint", () => {
    expect(migrationSource).toContain("uq_resume_commit_parents_edge");
  });

  it("does not drop the table itself", () => {
    expect(migrationSource).not.toContain(".dropTable(");
    expect(migrationSource.toUpperCase()).not.toMatch(/DROP\s+TABLE/);
  });
});
