import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "20260410212000_create_consultant_ai_preferences.ts");
const migrationSource = readFileSync(migrationPath, "utf8");

describe("create_consultant_ai_preferences migration", () => {
  it("creates consultant_ai_preferences", () => {
    expect(migrationSource).toContain('createTable("consultant_ai_preferences")');
  });

  it("stores prompt, rules, and validators", () => {
    expect(migrationSource).toContain('.addColumn("prompt", "text")');
    expect(migrationSource).toContain('.addColumn("rules", "text")');
    expect(migrationSource).toContain('.addColumn("validators", "text")');
  });
});
