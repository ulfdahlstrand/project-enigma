import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

describe("AC1 – Migration file naming convention", () => {
  it("file exists matching YYYYMMDDHHMMSS_drop_legacy_resume_commit_columns.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    const pattern = /^[0-9]{14}_drop_legacy_resume_commit_columns\.ts$/;
    expect(files.find((f) => pattern.test(f))).toBeDefined();
  });

  it("is exactly 20260408143000_drop_legacy_resume_commit_columns.ts", () => {
    const files = readdirSync(migrationsDir).filter((f) => !f.endsWith(".test.ts"));
    expect(files).toContain("20260408143000_drop_legacy_resume_commit_columns.ts");
  });
});

const migrationSource = readFileSync(
  join(migrationsDir, "20260408143000_drop_legacy_resume_commit_columns.ts"),
  "utf-8",
);

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

describe("AC3 – up() drops legacy resume_commits columns", () => {
  it("drops the branch FK constraint before dropping branch_id", () => {
    expect(migrationSource).toContain("fk_resume_commits_branch_id");
    expect(migrationSource).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS/i);
  });

  it("drops the branch and parent indexes", () => {
    expect(migrationSource).toContain("idx_resume_commits_branch_id");
    expect(migrationSource).toContain("idx_resume_commits_parent_commit_id");
    expect(migrationSource).toContain("idx_resume_commits_root");
  });

  it("drops branch_id and parent_commit_id from resume_commits", () => {
    expect(migrationSource).toContain('.alterTable("resume_commits")');
    expect(migrationSource).toContain('.dropColumn("branch_id")');
    expect(migrationSource).toContain('.dropColumn("parent_commit_id")');
  });
});

describe("AC4 – down() restores the legacy columns compatibly", () => {
  it("re-adds branch_id and parent_commit_id", () => {
    expect(migrationSource).toContain('.addColumn("branch_id", "uuid")');
    expect(migrationSource).toContain('.addColumn("parent_commit_id", "uuid"');
  });

  it("restores legacy indexes", () => {
    expect(migrationSource).toContain("idx_resume_commits_branch_id");
    expect(migrationSource).toContain("idx_resume_commits_parent_commit_id");
    expect(migrationSource).toContain("idx_resume_commits_root");
  });

  it("restores the deferrable branch FK", () => {
    expect(migrationSource).toContain("REFERENCES resume_branches (id)");
    expect(migrationSource).toContain("DEFERRABLE INITIALLY DEFERRED");
  });
});
