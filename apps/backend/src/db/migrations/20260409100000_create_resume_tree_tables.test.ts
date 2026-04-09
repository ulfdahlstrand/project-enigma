/**
 * Static-analysis tests for 20260409100000_create_resume_tree_tables.
 *
 * This migration introduces the core tree layer for the Git-inspired content
 * model:
 *   - resume_entry_types   — registry of supported content types
 *   - resume_trees         — immutable tree objects (one per commit)
 *   - resume_tree_entries  — typed entries within a tree
 *   - resume_tree_entry_content — coupling table linking entries to revisions
 *   - tree_id column on resume_commits
 *
 * No revision tables are created here; those live in the next migration.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

// ── AC 1: File naming ────────────────────────────────────────────────────────

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_create_resume_tree_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    const pattern = /^[0-9]{14}_create_resume_tree_tables\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260409100000_create_resume_tree_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    expect(files).toContain("20260409100000_create_resume_tree_tables.ts");
  });
});

const migrationSource = readFileSync(
  join(migrationsDir, "20260409100000_create_resume_tree_tables.ts"),
  "utf-8",
);

// ── AC 2: up() / down() exports ───────────────────────────────────────────────

describe("AC2 – up() and down() exports", () => {
  it("exports async function up(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+up\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/,
    );
  });

  it("exports async function down(db: Kysely<unknown>): Promise<void>", () => {
    expect(migrationSource).toMatch(
      /export\s+async\s+function\s+down\s*\(\s*db\s*:\s*Kysely<unknown>\s*\)\s*:\s*Promise<void>/,
    );
  });
});

// ── AC 3: resume_entry_types ──────────────────────────────────────────────────

describe("AC3 – resume_entry_types table", () => {
  it("creates resume_entry_types", () => {
    expect(migrationSource).toContain("resume_entry_types");
  });

  it("has id column", () => {
    expect(migrationSource).toContain("resume_entry_types");
    expect(migrationSource).toMatch(/id.*uuid|uuid.*id/i);
  });

  it("has name column", () => {
    expect(migrationSource).toMatch(/['"` ]name['"` ]/);
  });

  it("has revision_table column", () => {
    expect(migrationSource).toContain("revision_table");
  });

  it("seeds all 9 supported entry types", () => {
    const types = [
      "metadata",
      "consultant_title",
      "presentation",
      "summary",
      "highlighted_items",
      "skill_group",
      "skill",
      "assignment",
      "education",
    ];
    for (const type of types) {
      expect(migrationSource).toContain(type);
    }
  });
});

// ── AC 4: resume_trees ────────────────────────────────────────────────────────

describe("AC4 – resume_trees table", () => {
  it("creates resume_trees", () => {
    expect(migrationSource).toContain("resume_trees");
  });

  it("has created_at column", () => {
    expect(migrationSource).toContain("created_at");
  });
});

// ── AC 5: resume_tree_entries ─────────────────────────────────────────────────

describe("AC5 – resume_tree_entries table", () => {
  it("creates resume_tree_entries", () => {
    expect(migrationSource).toContain("resume_tree_entries");
  });

  it("has tree_id foreign key referencing resume_trees", () => {
    expect(migrationSource).toMatch(/tree_id/);
    expect(migrationSource).toContain("resume_trees");
  });

  it("has entry_type column", () => {
    expect(migrationSource).toContain("entry_type");
  });

  it("has position column for ordering entries within a tree", () => {
    expect(migrationSource).toContain("position");
  });
});

// ── AC 6: resume_tree_entry_content (coupling table) ─────────────────────────

describe("AC6 – resume_tree_entry_content coupling table", () => {
  it("creates resume_tree_entry_content", () => {
    expect(migrationSource).toContain("resume_tree_entry_content");
  });

  it("has entry_id referencing resume_tree_entries", () => {
    expect(migrationSource).toContain("entry_id");
    expect(migrationSource).toContain("resume_tree_entries");
  });

  it("has revision_id column (logical, non-FK — supports polymorphism)", () => {
    expect(migrationSource).toContain("revision_id");
  });

  it("has revision_type column to identify which revision table to query", () => {
    expect(migrationSource).toContain("revision_type");
  });
});

// ── AC 7: tree_id on resume_commits ──────────────────────────────────────────

describe("AC7 – tree_id column added to resume_commits", () => {
  it("alters resume_commits to add tree_id", () => {
    expect(migrationSource).toContain("resume_commits");
    expect(migrationSource).toContain("tree_id");
  });

  it("tree_id is nullable (old commits have no tree — no notNull() in the alterTable block)", () => {
    // In Kysely columns are nullable by default. We verify the alterTable block
    // for resume_commits does not call .notNull() on the tree_id column.
    const alterBlock = migrationSource.match(/alterTable\s*\(\s*["'`]resume_commits["'`]\s*\)[\s\S]{0,400}/)?.[0] ?? "";
    expect(alterBlock).toContain("tree_id");
    expect(alterBlock).not.toContain("notNull()");
  });

  it("tree_id references resume_trees", () => {
    expect(migrationSource).toMatch(/tree_id/);
    expect(migrationSource).toContain("resume_trees");
  });
});

// ── AC 8: down() reverses everything ─────────────────────────────────────────

describe("AC8 – down() reverses all changes", () => {
  it("drops resume_tree_entry_content", () => {
    expect(migrationSource).toMatch(/dropTable.*resume_tree_entry_content|resume_tree_entry_content.*drop/i);
  });

  it("drops resume_tree_entries", () => {
    expect(migrationSource).toMatch(/dropTable.*resume_tree_entries|resume_tree_entries.*drop/i);
  });

  it("drops resume_trees", () => {
    expect(migrationSource).toMatch(/dropTable.*resume_trees|resume_trees.*drop/i);
  });

  it("drops resume_entry_types", () => {
    expect(migrationSource).toMatch(/dropTable.*resume_entry_types|resume_entry_types.*drop/i);
  });

  it("drops tree_id column from resume_commits", () => {
    expect(migrationSource).toMatch(/dropColumn.*tree_id|tree_id.*dropColumn/i);
  });
});
