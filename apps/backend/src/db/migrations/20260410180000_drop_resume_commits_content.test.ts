import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260410120000_drop_resume_commits_content.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_drop_resume_commits_content.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_drop_resume_commits_content\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260410120000_drop_resume_commits_content.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    expect(files).toContain("20260410120000_drop_resume_commits_content.ts");
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

describe("AC3 – up() drops the content column", () => {
  it("targets resume_commits table", () => {
    expect(migrationSource).toContain('.alterTable("resume_commits")');
  });

  it("drops the content column", () => {
    expect(migrationSource).toContain('.dropColumn("content")');
  });
});

describe("AC4 – down() restores the column", () => {
  it("adds content back as jsonb", () => {
    expect(migrationSource).toMatch(/ADD\s+COLUMN\s+content\s+jsonb/i);
  });
});
