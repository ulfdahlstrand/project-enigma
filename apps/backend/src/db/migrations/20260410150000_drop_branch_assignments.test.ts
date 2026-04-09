import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260410150000_drop_branch_assignments.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_drop_branch_assignments.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_drop_branch_assignments\.ts$/;
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

describe("AC3 – up() drops the legacy branch_assignments table", () => {
  it("drops branch_assignments", () => {
    expect(migrationSource).toContain("DROP TABLE IF EXISTS branch_assignments");
  });
});

describe("AC4 – down() recreates branch_assignments with indexes", () => {
  it("creates branch_assignments", () => {
    expect(migrationSource).toMatch(/CREATE TABLE IF NOT EXISTS branch_assignments/);
  });

  it("restores the branch_id index", () => {
    expect(migrationSource).toMatch(/CREATE INDEX IF NOT EXISTS idx_branch_assignments_branch_id/);
  });

  it("restores the assignment_id index", () => {
    expect(migrationSource).toMatch(/CREATE INDEX IF NOT EXISTS idx_branch_assignments_assignment_id/);
  });

  it("restores the unique branch\/assignment constraint", () => {
    expect(migrationSource).toMatch(/uq_branch_assignments_branch_assignment UNIQUE \(branch_id, assignment_id\)/);
  });
});
