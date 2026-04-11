import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "20260410210000_seed_external_ai_prompt_guidance.ts");
const migrationSource = readFileSync(migrationPath, "utf8");

describe("seed_external_ai_prompt_guidance migration", () => {
  it("seeds an external ai prompt category", () => {
    expect(migrationSource).toContain('key: "external_ai"');
    expect(migrationSource).toContain('title: "External AI Guidance"');
  });

  it("seeds external-safe prompt definitions", () => {
    expect(migrationSource).toContain('key: "external-ai.shared-guidance"');
    expect(migrationSource).toContain('key: "external-ai.assignment-guidance"');
    expect(migrationSource).toContain('key: "external-ai.presentation-guidance"');
  });

  it("keeps the guidance editable in the prompt config system", () => {
    expect(migrationSource).toContain("is_editable: true");
  });
});
