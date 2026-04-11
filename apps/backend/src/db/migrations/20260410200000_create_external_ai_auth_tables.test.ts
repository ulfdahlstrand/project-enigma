import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSource = readFileSync(
  join(__dirname, "20260410200000_create_external_ai_auth_tables.ts"),
  "utf-8",
);

describe("create_external_ai_auth_tables migration", () => {
  it("has the expected filename", () => {
    expect(
      readdirSync(__dirname).filter((file) => !file.endsWith(".test.ts")),
    ).toContain("20260410200000_create_external_ai_auth_tables.ts");
  });

  it("creates the external ai auth tables", () => {
    expect(migrationSource).toContain('createTable("external_ai_clients")');
    expect(migrationSource).toContain('createTable("external_ai_authorizations")');
    expect(migrationSource).toContain('createTable("external_ai_login_challenges")');
    expect(migrationSource).toContain('createTable("external_ai_access_tokens")');
  });

  it("seeds the first supported external ai clients", () => {
    expect(migrationSource).toContain("anthropic_claude");
    expect(migrationSource).toContain("openai_chatgpt");
    expect(migrationSource).toContain("custom_mcp_client");
  });
});
