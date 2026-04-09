import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260410130000_drop_live_skill_tables.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_drop_live_skill_tables.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_drop_live_skill_tables\.ts$/;
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

describe("AC3 – up() drops all three live tables", () => {
  it("drops resume_highlighted_items", () => {
    expect(migrationSource).toContain("resume_highlighted_items");
  });

  it("drops resume_skills", () => {
    expect(migrationSource).toContain("resume_skills");
  });

  it("drops resume_skill_groups", () => {
    expect(migrationSource).toContain("resume_skill_groups");
  });
});

describe("AC4 – down() recreates all three tables", () => {
  it("creates resume_skill_groups", () => {
    expect(migrationSource).toMatch(/CREATE TABLE IF NOT EXISTS resume_skill_groups/);
  });

  it("creates resume_skills", () => {
    expect(migrationSource).toMatch(/CREATE TABLE IF NOT EXISTS resume_skills/);
  });

  it("creates resume_highlighted_items", () => {
    expect(migrationSource).toMatch(/CREATE TABLE IF NOT EXISTS resume_highlighted_items/);
  });
});
