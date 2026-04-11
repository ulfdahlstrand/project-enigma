import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "20260410211000_add_external_ai_prompt_layers.ts");
const migrationSource = readFileSync(migrationPath, "utf8");

describe("add_external_ai_prompt_layers migration", () => {
  it("adds output contract fragments", () => {
    expect(migrationSource).toContain('key: "output_contract"');
  });

  it("adds context requirements where section context matters", () => {
    expect(migrationSource).toContain('key: "context_requirements"');
    expect(migrationSource).toContain('promptKey: "external-ai.assignment-guidance"');
    expect(migrationSource).toContain('promptKey: "external-ai.presentation-guidance"');
  });
});
