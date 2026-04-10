import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260410192000_add_keywords_to_resume_revision_assignment.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_add_keywords_to_resume_revision_assignment.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_add_keywords_to_resume_revision_assignment\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260410192000_add_keywords_to_resume_revision_assignment.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    expect(files).toContain("20260410192000_add_keywords_to_resume_revision_assignment.ts");
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

describe("AC3 – up() adds the keywords column", () => {
  it("targets resume_revision_assignment", () => {
    expect(migrationSource).toContain("resume_revision_assignment");
  });

  it("adds keywords as text", () => {
    expect(migrationSource).toMatch(/addColumn\(\s*"keywords"\s*,\s*"text"/);
  });
});

describe("AC4 – down() removes the keywords column", () => {
  it("drops the keywords column", () => {
    expect(migrationSource).toMatch(/dropColumn\(\s*"keywords"\s*\)/);
  });
});
