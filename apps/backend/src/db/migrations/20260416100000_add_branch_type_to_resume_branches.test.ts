import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

const migrationSource = readFileSync(
  join(migrationsDir, "20260416100000_add_branch_type_to_resume_branches.ts"),
  "utf-8",
);

describe("AC1 – Migration file naming convention", () => {
  it("is exactly 20260416100000_add_branch_type_to_resume_branches.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    expect(files).toContain("20260416100000_add_branch_type_to_resume_branches.ts");
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

describe("AC3 – up() adds branch_type, source_branch_id, source_commit_id", () => {
  it("targets resume_branches", () => {
    expect(migrationSource).toContain("resume_branches");
  });

  it("adds branch_type as varchar(16) NOT NULL DEFAULT 'variant'", () => {
    expect(migrationSource).toMatch(/addColumn\(\s*"branch_type"\s*,\s*"varchar\(16\)"/);
    expect(migrationSource).toMatch(/defaultTo\(\s*"variant"\s*\)/);
  });

  it("adds source_branch_id as uuid referencing resume_branches(id)", () => {
    expect(migrationSource).toMatch(/addColumn\(\s*"source_branch_id"\s*,\s*"uuid"/);
    expect(migrationSource).toMatch(/references\(\s*"resume_branches\.id"\s*\)/);
  });

  it("adds source_commit_id as uuid referencing resume_commits(id)", () => {
    expect(migrationSource).toMatch(/addColumn\(\s*"source_commit_id"\s*,\s*"uuid"/);
    expect(migrationSource).toMatch(/references\(\s*"resume_commits\.id"\s*\)/);
  });
});

describe("AC4 – CHECK constraints enforce the type model", () => {
  it("adds branch_type_check constraint restricting to the three types", () => {
    expect(migrationSource).toContain("branch_type_check");
    expect(migrationSource).toContain("'variant'");
    expect(migrationSource).toContain("'translation'");
    expect(migrationSource).toContain("'revision'");
  });

  it("adds branch_source_check pairing type with source columns", () => {
    expect(migrationSource).toContain("branch_source_check");
  });
});

describe("AC5 – source_branch_id has an index", () => {
  it("creates idx_resume_branches_source_branch_id", () => {
    expect(migrationSource).toContain("idx_resume_branches_source_branch_id");
  });
});

describe("AC6 – down() removes columns and constraints", () => {
  it("drops branch_type column", () => {
    expect(migrationSource).toMatch(/dropColumn\(\s*"branch_type"\s*\)/);
  });

  it("drops source_branch_id column", () => {
    expect(migrationSource).toMatch(/dropColumn\(\s*"source_branch_id"\s*\)/);
  });

  it("drops source_commit_id column", () => {
    expect(migrationSource).toMatch(/dropColumn\(\s*"source_commit_id"\s*\)/);
  });
});
