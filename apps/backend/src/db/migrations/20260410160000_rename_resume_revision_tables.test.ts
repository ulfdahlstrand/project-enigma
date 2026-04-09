import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260410160000_rename_resume_revision_tables.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_rename_resume_revision_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_rename_resume_revision_tables\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });
});

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

describe("AC3 – table renames cover all revision tables", () => {
  it("renames metadata", () => {
    expect(migrationSource).toContain('["resume_metadata_revisions", "resume_revision_metadata"]');
  });

  it("renames consultant title", () => {
    expect(migrationSource).toContain('["consultant_title_revisions", "resume_revision_consultant_title"]');
  });

  it("renames presentation", () => {
    expect(migrationSource).toContain('["presentation_revisions", "resume_revision_presentation"]');
  });

  it("renames summary", () => {
    expect(migrationSource).toContain('["summary_revisions", "resume_revision_summary"]');
  });

  it("renames highlighted items", () => {
    expect(migrationSource).toContain('["highlighted_item_revisions", "resume_revision_highlighted_item"]');
  });

  it("renames skill groups", () => {
    expect(migrationSource).toContain('["skill_group_revisions", "resume_revision_skill_group"]');
  });

  it("renames skills", () => {
    expect(migrationSource).toContain('["skill_revisions", "resume_revision_skill"]');
  });

  it("renames assignments", () => {
    expect(migrationSource).toContain('["assignment_revisions", "resume_revision_assignment"]');
  });

  it("renames education", () => {
    expect(migrationSource).toContain('["education_revisions", "resume_revision_education"]');
  });
});

describe("AC4 – polymorphic revision pointers are rewritten", () => {
  it("updates resume_entry_types.revision_table", () => {
    expect(migrationSource).toContain("UPDATE resume_entry_types");
  });

  it("updates resume_tree_entry_content.revision_type", () => {
    expect(migrationSource).toContain("UPDATE resume_tree_entry_content");
  });
});
