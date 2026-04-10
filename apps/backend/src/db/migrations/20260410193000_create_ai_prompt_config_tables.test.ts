import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSource = readFileSync(
  join(__dirname, "20260410193000_create_ai_prompt_config_tables.ts"),
  "utf-8",
);

describe("create_ai_prompt_config_tables migration", () => {
  it("has the expected filename", () => {
    expect(
      readdirSync(__dirname).filter((file) => !file.endsWith(".test.ts")),
    ).toContain("20260410193000_create_ai_prompt_config_tables.ts");
  });

  it("creates prompt categories, definitions, and fragments tables", () => {
    expect(migrationSource).toContain('createTable("ai_prompt_categories")');
    expect(migrationSource).toContain('createTable("ai_prompt_definitions")');
    expect(migrationSource).toContain('createTable("ai_prompt_fragments")');
  });

  it("stores editable prompts and fragment content", () => {
    expect(migrationSource).toContain("is_editable");
    expect(migrationSource).toContain("frontend.unified-revision");
    expect(migrationSource).toContain("backend.improve-description");
    expect(migrationSource).toContain("backend.conversation-title");
  });
});
