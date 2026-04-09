/**
 * Static-analysis tests for 20260409110000_create_resume_revision_tables.
 *
 * This migration creates all 9 immutable revision tables that store CV content
 * in the Git-inspired content model. Each revision row is write-once; content
 * deduplication means unchanged sections share the same revision_id across
 * consecutive commits.
 *
 * Tables created:
 *   resume_revision_metadata      — title, language
 *   resume_revision_consultant_title     — value TEXT
 *   resume_revision_presentation         — paragraphs TEXT[]
 *   resume_revision_summary              — content TEXT
 *   resume_revision_highlighted_item     — items TEXT[]
 *   resume_revision_skill_group          — name, sort_order
 *   resume_revision_skill                — name, group_revision_id, sort_order
 *   resume_revision_assignment           — all assignment fields
 *   resume_revision_education            — type, value, sort_order (snapshot of employee education)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

// ── AC 1: File naming ────────────────────────────────────────────────────────

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_create_resume_revision_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    const pattern = /^[0-9]{14}_create_resume_revision_tables\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260409110000_create_resume_revision_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter(
      (f) => !f.endsWith(".test.ts"),
    );
    expect(files).toContain("20260409110000_create_resume_revision_tables.ts");
  });
});

const migrationSource = readFileSync(
  join(migrationsDir, "20260409110000_create_resume_revision_tables.ts"),
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

// ── AC 3: resume_revision_metadata ──────────────────────────────────────────

describe("AC3 – resume_revision_metadata", () => {
  it("creates resume_revision_metadata", () => {
    expect(migrationSource).toContain("resume_revision_metadata");
  });

  it("has title and language columns", () => {
    expect(migrationSource).toMatch(/title/);
    expect(migrationSource).toMatch(/language/);
  });

  it("has created_at column", () => {
    expect(migrationSource).toContain("created_at");
  });
});

// ── AC 4: resume_revision_consultant_title ─────────────────────────────────────────

describe("AC4 – resume_revision_consultant_title", () => {
  it("creates resume_revision_consultant_title", () => {
    expect(migrationSource).toContain("resume_revision_consultant_title");
  });

  it("has value column", () => {
    expect(migrationSource).toMatch(/['"` ]value['"` ]/);
  });
});

// ── AC 5: resume_revision_presentation ─────────────────────────────────────────────

describe("AC5 – resume_revision_presentation", () => {
  it("creates resume_revision_presentation", () => {
    expect(migrationSource).toContain("resume_revision_presentation");
  });

  it("has paragraphs column as text array", () => {
    expect(migrationSource).toContain("paragraphs");
    expect(migrationSource).toMatch(/text\[\]|text array/i);
  });
});

// ── AC 6: resume_revision_summary ───────────────────────────────────────────────────

describe("AC6 – resume_revision_summary", () => {
  it("creates resume_revision_summary", () => {
    expect(migrationSource).toContain("resume_revision_summary");
  });

  it("has content column", () => {
    expect(migrationSource).toContain("content");
  });
});

// ── AC 7: resume_revision_highlighted_item ─────────────────────────────────────────

describe("AC7 – resume_revision_highlighted_item", () => {
  it("creates resume_revision_highlighted_item", () => {
    expect(migrationSource).toContain("resume_revision_highlighted_item");
  });

  it("has items column as text array", () => {
    expect(migrationSource).toContain("items");
    expect(migrationSource).toMatch(/text\[\]|text array/i);
  });
});

// ── AC 8: resume_revision_skill_group ───────────────────────────────────────────────

describe("AC8 – resume_revision_skill_group", () => {
  it("creates resume_revision_skill_group", () => {
    expect(migrationSource).toContain("resume_revision_skill_group");
  });

  it("has name and sort_order columns", () => {
    expect(migrationSource).toMatch(/['"` ]name['"` ]/);
    expect(migrationSource).toContain("sort_order");
  });
});

// ── AC 9: resume_revision_skill ─────────────────────────────────────────────────────

describe("AC9 – resume_revision_skill", () => {
  it("creates resume_revision_skill", () => {
    expect(migrationSource).toContain("resume_revision_skill");
  });

  it("has name and sort_order columns", () => {
    expect(migrationSource).toMatch(/['"` ]name['"` ]/);
    expect(migrationSource).toContain("sort_order");
  });

  it("has group_revision_id referencing resume_revision_skill_group", () => {
    expect(migrationSource).toContain("group_revision_id");
    expect(migrationSource).toContain("resume_revision_skill_group");
  });
});

// ── AC 10: resume_revision_assignment ───────────────────────────────────────────────

describe("AC10 – resume_revision_assignment", () => {
  it("creates resume_revision_assignment", () => {
    expect(migrationSource).toContain("resume_revision_assignment");
  });

  it("has assignment_id referencing the assignments entity table", () => {
    expect(migrationSource).toContain("assignment_id");
    expect(migrationSource).toContain("assignments");
  });

  it("has client_name, role, description columns", () => {
    expect(migrationSource).toContain("client_name");
    expect(migrationSource).toContain("role");
    expect(migrationSource).toContain("description");
  });

  it("has start_date and end_date columns", () => {
    expect(migrationSource).toContain("start_date");
    expect(migrationSource).toContain("end_date");
  });

  it("has technologies column as text array", () => {
    expect(migrationSource).toContain("technologies");
    expect(migrationSource).toMatch(/text\[\]|text array/i);
  });

  it("has is_current column", () => {
    expect(migrationSource).toContain("is_current");
  });

  it("has sort_order column", () => {
    expect(migrationSource).toContain("sort_order");
  });
});

// ── AC 11: resume_revision_education ────────────────────────────────────────────────

describe("AC11 – resume_revision_education", () => {
  it("creates resume_revision_education", () => {
    expect(migrationSource).toContain("resume_revision_education");
  });

  it("has employee_id to tie the snapshot to an employee", () => {
    expect(migrationSource).toContain("employee_id");
  });

  it("has type column for degree / certification / language", () => {
    expect(migrationSource).toMatch(/['"` ]type['"` ]/);
  });

  it("has value and sort_order columns", () => {
    expect(migrationSource).toMatch(/['"` ]value['"` ]/);
    expect(migrationSource).toContain("sort_order");
  });
});

// ── AC 12: down() drops all revision tables ───────────────────────────────────

describe("AC12 – down() drops all revision tables", () => {
  const tables = [
    "resume_revision_education",
    "resume_revision_assignment",
    "resume_revision_skill",
    "resume_revision_skill_group",
    "resume_revision_highlighted_item",
    "resume_revision_summary",
    "resume_revision_presentation",
    "resume_revision_consultant_title",
    "resume_revision_metadata",
  ];

  for (const table of tables) {
    it(`drops ${table}`, () => {
      expect(migrationSource).toMatch(
        new RegExp(`dropTable.*${table}|${table}.*drop`, "i"),
      );
    });
  }

  it("does not drop tables outside this migration's scope", () => {
    expect(migrationSource).not.toMatch(/dropTable.*resume_tree/i);
    expect(migrationSource).not.toMatch(/dropTable.*resume_commits/i);
  });
});
