/**
 * Static-analysis tests for 20260409110000_create_resume_revision_tables.
 *
 * This migration creates all 9 immutable revision tables that store CV content
 * in the Git-inspired content model. Each revision row is write-once; content
 * deduplication means unchanged sections share the same revision_id across
 * consecutive commits.
 *
 * Tables created:
 *   resume_metadata_revisions      — title, language
 *   consultant_title_revisions     — value TEXT
 *   presentation_revisions         — paragraphs TEXT[]
 *   summary_revisions              — content TEXT
 *   highlighted_item_revisions     — items TEXT[]
 *   skill_group_revisions          — name, sort_order
 *   skill_revisions                — name, group_revision_id, sort_order
 *   assignment_revisions           — all assignment fields
 *   education_revisions            — type, value, sort_order (snapshot of employee education)
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

// ── AC 3: resume_metadata_revisions ──────────────────────────────────────────

describe("AC3 – resume_metadata_revisions", () => {
  it("creates resume_metadata_revisions", () => {
    expect(migrationSource).toContain("resume_metadata_revisions");
  });

  it("has title and language columns", () => {
    expect(migrationSource).toMatch(/title/);
    expect(migrationSource).toMatch(/language/);
  });

  it("has created_at column", () => {
    expect(migrationSource).toContain("created_at");
  });
});

// ── AC 4: consultant_title_revisions ─────────────────────────────────────────

describe("AC4 – consultant_title_revisions", () => {
  it("creates consultant_title_revisions", () => {
    expect(migrationSource).toContain("consultant_title_revisions");
  });

  it("has value column", () => {
    expect(migrationSource).toMatch(/['"` ]value['"` ]/);
  });
});

// ── AC 5: presentation_revisions ─────────────────────────────────────────────

describe("AC5 – presentation_revisions", () => {
  it("creates presentation_revisions", () => {
    expect(migrationSource).toContain("presentation_revisions");
  });

  it("has paragraphs column as text array", () => {
    expect(migrationSource).toContain("paragraphs");
    expect(migrationSource).toMatch(/text\[\]|text array/i);
  });
});

// ── AC 6: summary_revisions ───────────────────────────────────────────────────

describe("AC6 – summary_revisions", () => {
  it("creates summary_revisions", () => {
    expect(migrationSource).toContain("summary_revisions");
  });

  it("has content column", () => {
    expect(migrationSource).toContain("content");
  });
});

// ── AC 7: highlighted_item_revisions ─────────────────────────────────────────

describe("AC7 – highlighted_item_revisions", () => {
  it("creates highlighted_item_revisions", () => {
    expect(migrationSource).toContain("highlighted_item_revisions");
  });

  it("has items column as text array", () => {
    expect(migrationSource).toContain("items");
    expect(migrationSource).toMatch(/text\[\]|text array/i);
  });
});

// ── AC 8: skill_group_revisions ───────────────────────────────────────────────

describe("AC8 – skill_group_revisions", () => {
  it("creates skill_group_revisions", () => {
    expect(migrationSource).toContain("skill_group_revisions");
  });

  it("has name and sort_order columns", () => {
    expect(migrationSource).toMatch(/['"` ]name['"` ]/);
    expect(migrationSource).toContain("sort_order");
  });
});

// ── AC 9: skill_revisions ─────────────────────────────────────────────────────

describe("AC9 – skill_revisions", () => {
  it("creates skill_revisions", () => {
    expect(migrationSource).toContain("skill_revisions");
  });

  it("has name and sort_order columns", () => {
    expect(migrationSource).toMatch(/['"` ]name['"` ]/);
    expect(migrationSource).toContain("sort_order");
  });

  it("has group_revision_id referencing skill_group_revisions", () => {
    expect(migrationSource).toContain("group_revision_id");
    expect(migrationSource).toContain("skill_group_revisions");
  });
});

// ── AC 10: assignment_revisions ───────────────────────────────────────────────

describe("AC10 – assignment_revisions", () => {
  it("creates assignment_revisions", () => {
    expect(migrationSource).toContain("assignment_revisions");
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

// ── AC 11: education_revisions ────────────────────────────────────────────────

describe("AC11 – education_revisions", () => {
  it("creates education_revisions", () => {
    expect(migrationSource).toContain("education_revisions");
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
    "education_revisions",
    "assignment_revisions",
    "skill_revisions",
    "skill_group_revisions",
    "highlighted_item_revisions",
    "summary_revisions",
    "presentation_revisions",
    "consultant_title_revisions",
    "resume_metadata_revisions",
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
