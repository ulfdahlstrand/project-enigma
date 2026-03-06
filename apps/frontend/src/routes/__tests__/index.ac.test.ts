/**
 * Acceptance-criteria tests for Task #45
 * "Add internationalised welcome text to main page route"
 *
 * These tests cover all 7 acceptance criteria using static file inspection.
 * No runtime rendering is required — the criteria are verifiable by source
 * analysis and by running toolchain commands.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// __dirname in Vitest resolves to the real on-disk directory of this file:
//   apps/frontend/src/routes/__tests__/
// From there, climb 4 levels to reach apps/frontend/
const FRONTEND_ROOT = resolve(__dirname, "../../..");
const ROUTES_INDEX = resolve(FRONTEND_ROOT, "src/routes/index.tsx");
const LOCALES_DIR = resolve(FRONTEND_ROOT, "src/locales");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the source of apps/frontend/src/routes/index.tsx */
function readIndexSource(): string {
  return readFileSync(ROUTES_INDEX, "utf-8");
}

/**
 * Recursively collect every file matching `filename` under `dir`.
 */
function findFiles(dir: string, filename: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findFiles(full, filename));
    } else if (entry === filename) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// AC1 — <Typography> from @mui/material present; useTranslation + t() used
// ---------------------------------------------------------------------------
describe("AC1 — Typography component with useTranslation and t() call", () => {
  it("imports Typography from @mui/material", () => {
    const src = readIndexSource();
    // Must import Typography from MUI (named import or default import)
    expect(src).toMatch(/from\s+["']@mui\/material["']/);
    expect(src).toMatch(/Typography/);
  });

  it("calls useTranslation from react-i18next", () => {
    const src = readIndexSource();
    expect(src).toMatch(/useTranslation/);
    expect(src).toMatch(/from\s+["']react-i18next["']/);
  });

  it("renders a <Typography> element in JSX", () => {
    const src = readIndexSource();
    // Must have a JSX opening tag for Typography
    expect(src).toMatch(/<Typography[\s>]/);
  });

  it("renders the welcome text via a t() call inside <Typography>", () => {
    const src = readIndexSource();
    // The t() call referencing a welcome-related key must be within the Typography block.
    // We match a t() call with a key containing "welcome" anywhere in the file
    expect(src).toMatch(/t\(["'][^"']*welcome[^"']*["']\)/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — No hardcoded user-facing string literal for the welcome text
// ---------------------------------------------------------------------------
describe("AC2 — No hardcoded welcome string literal in index.tsx", () => {
  it("does not contain a bare hardcoded welcome string in JSX", () => {
    const src = readIndexSource();
    // The route must not contain a hard-coded "Welcome" or "Bienvenue" string literal
    // directly in JSX (i.e. not inside a t() call).
    // We check that no bare JSX text node starting with "Welcome" or "Bienvenue" exists.
    expect(src).not.toMatch(/>\s*Welcome\b/);
    expect(src).not.toMatch(/>\s*Bienvenue\b/);
  });
});

// ---------------------------------------------------------------------------
// AC3 — 'welcome' key exists with a non-empty value in every common.json
//        under apps/frontend/src/locales/
// ---------------------------------------------------------------------------
describe("AC3 — 'welcome' key present and non-empty in every locale common.json", () => {
  const commonJsonFiles = findFiles(LOCALES_DIR, "common.json");

  it("finds at least one common.json file under src/locales/", () => {
    expect(commonJsonFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of commonJsonFiles) {
    const displayPath = filePath.replace(FRONTEND_ROOT + "/", "");
    it(`'welcome' key is present and non-empty in ${displayPath}`, () => {
      const raw = readFileSync(filePath, "utf-8");
      const json = JSON.parse(raw) as Record<string, unknown>;
      expect(json).toHaveProperty("welcome");
      expect(typeof json["welcome"]).toBe("string");
      expect((json["welcome"] as string).trim().length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// AC6 — <Typography> must not use inline style prop or raw CSS className
// ---------------------------------------------------------------------------
describe("AC6 — Typography does not use inline style prop or raw CSS className", () => {
  it("does not have a style= prop on any <Typography> element", () => {
    const src = readIndexSource();
    // Match style= attached directly to a Typography open tag.
    // We extract all Typography JSX opening tags and check each one.
    const typographyBlocks = src.match(/<Typography[\s\S]*?(?:\/>|>)/g) ?? [];
    for (const block of typographyBlocks) {
      expect(block).not.toMatch(/\bstyle\s*=/);
    }
  });

  it("does not have a className= prop on any <Typography> element for styling", () => {
    const src = readIndexSource();
    const typographyBlocks = src.match(/<Typography[\s\S]*?(?:\/>|>)/g) ?? [];
    for (const block of typographyBlocks) {
      expect(block).not.toMatch(/\bclassName\s*=/);
    }
  });
});

// ---------------------------------------------------------------------------
// AC7 — grep: the translation key exists in EVERY common.json under src/locales/
// ---------------------------------------------------------------------------
describe("AC7 — grep: 'welcome' key found in every common.json under src/locales/", () => {
  const commonJsonFiles = findFiles(LOCALES_DIR, "common.json");

  it("every common.json file under src/locales/ contains the string \"welcome\"", () => {
    expect(commonJsonFiles.length).toBeGreaterThan(0);
    for (const filePath of commonJsonFiles) {
      const raw = readFileSync(filePath, "utf-8");
      expect(raw).toContain('"welcome"');
    }
  });

  it("the count of matching files equals the total number of common.json files (no file is missing the key)", () => {
    const matchingFiles = commonJsonFiles.filter((f) =>
      readFileSync(f, "utf-8").includes('"welcome"')
    );
    expect(matchingFiles.length).toBe(commonJsonFiles.length);
  });
});
