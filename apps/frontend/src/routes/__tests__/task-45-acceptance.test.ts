/**
 * Acceptance tests for Task #45
 * "Add internationalised welcome text to main page route"
 *
 * All 7 acceptance criteria are verified here via static file inspection
 * and command execution. Tests are non-rendering (no DOM/jsdom needed)
 * since the criteria can be verified through static analysis and CLI commands.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

// __dirname = apps/frontend/src/routes/__tests__
// Go up 3 levels: __tests__ -> routes -> src -> frontend
const FRONTEND_ROOT = path.resolve(__dirname, "../../../");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

function srcPath(...segments: string[]): string {
  return path.join(SRC_ROOT, ...segments);
}

function readSrc(...segments: string[]): string {
  return fs.readFileSync(srcPath(...segments), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1 — index.tsx contains a <Typography> from @mui/material rendered via
//        useTranslation hook and a t() call
// ---------------------------------------------------------------------------
describe("AC1: routes/index.tsx contains MUI Typography component rendered via useTranslation + t()", () => {
  it("imports Typography from @mui/material", () => {
    const src = readSrc("routes", "index.tsx");
    // Accept both named import patterns: { Typography } from "@mui/material" or
    // default import from "@mui/material/Typography"
    const hasNamedImport = /import\s+\{[^}]*Typography[^}]*\}\s+from\s+["']@mui\/material["']/.test(src);
    const hasDefaultImport = /import\s+Typography\s+from\s+["']@mui\/material\/Typography["']/.test(src);
    expect(hasNamedImport || hasDefaultImport, "Typography must be imported from @mui/material").toBe(true);
  });

  it("calls useTranslation from react-i18next", () => {
    const src = readSrc("routes", "index.tsx");
    expect(src).toMatch(/import\s+\{[^}]*useTranslation[^}]*\}\s+from\s+["']react-i18next["']/);
    expect(src).toMatch(/useTranslation\s*\(/);
  });

  it("renders a <Typography> JSX element in the component", () => {
    const src = readSrc("routes", "index.tsx");
    expect(src).toMatch(/<Typography[\s>]/);
  });

  it("the <Typography> element renders its content via a t() call", () => {
    const src = readSrc("routes", "index.tsx");
    // Match a Typography JSX element that contains a {t("...")} or {t('...')} expression
    expect(src).toMatch(/<Typography[^>]*>\s*\{t\(["'][^"']+["']\)\}\s*<\/Typography>/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — index.tsx contains no hardcoded user-facing string for the welcome text;
//        the rendered value is sourced exclusively from a t() call
// ---------------------------------------------------------------------------
describe("AC2: routes/index.tsx uses only t() for the welcome text — no hardcoded string literals", () => {
  it("does not render the welcome string as a bare JSX text literal inside Typography", () => {
    const src = readSrc("routes", "index.tsx");
    // Find any Typography block and check it has no bare text content (non-t() strings)
    // Match <Typography ...> ... </Typography> blocks
    const typographyBlocks = [...src.matchAll(/<Typography[^>]*>([\s\S]*?)<\/Typography>/g)].map(
      (m) => m[1] ?? "",
    );
    for (const block of typographyBlocks) {
      // Remove allowed t() expression: {t("...")} or {t('...')}
      const withoutT = block.replace(/\{\s*t\(["'][^"']*["']\)\s*\}/g, "");
      // Check there's no remaining bare text (letters visible to user)
      expect(withoutT).not.toMatch(/[A-Za-z]/);
    }
  });

  it("does not have a JSX string expression like {'Welcome...'} or {\"Welcome...\"} in Typography", () => {
    const src = readSrc("routes", "index.tsx");
    const typographyBlocks = [...src.matchAll(/<Typography[^>]*>([\s\S]*?)<\/Typography>/g)].map(
      (m) => m[1] ?? "",
    );
    for (const block of typographyBlocks) {
      // Check for bare JS string expressions: {'...'} or {"..."}
      expect(block).not.toMatch(/\{\s*["'][A-Za-z][^"']*["']\s*\}/);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 — A 'welcome' key exists in every JSON file under apps/frontend/src/locales/
//        with a non-empty string value
// ---------------------------------------------------------------------------
describe("AC3: 'welcome' key exists in every common.json under apps/frontend/src/locales/", () => {
  function findAllCommonJsonFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findAllCommonJsonFiles(fullPath));
      } else if (entry.isFile() && entry.name === "common.json") {
        results.push(fullPath);
      }
    }
    return results;
  }

  const localesDir = srcPath("locales");
  const commonJsonFiles = findAllCommonJsonFiles(localesDir);

  it("at least one common.json file exists under src/locales/", () => {
    expect(commonJsonFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("every common.json has a top-level 'welcome' key", () => {
    for (const filePath of commonJsonFiles) {
      const json = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
      expect(
        json,
        `Expected 'welcome' key in ${filePath}`,
      ).toHaveProperty("welcome");
    }
  });

  it("every common.json 'welcome' value is a non-empty string", () => {
    for (const filePath of commonJsonFiles) {
      const json = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
      const welcomeValue = json["welcome"];
      expect(
        typeof welcomeValue,
        `'welcome' in ${filePath} should be a string`,
      ).toBe("string");
      expect(
        (welcomeValue as string).length,
        `'welcome' in ${filePath} should be non-empty`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 — npx tsc --noEmit exits with code 0 (no TypeScript errors)
// ---------------------------------------------------------------------------
describe("AC4: npx tsc --noEmit exits with code 0 (no TypeScript errors)", () => {
  it(
    "tsc --noEmit reports no errors in apps/frontend/",
    () => {
      let output = "";
      let exitCode = 0;
      try {
        output = execSync("npx tsc --noEmit", {
          cwd: FRONTEND_ROOT,
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const execError = err as { stdout?: string; stderr?: string; status?: number };
        output = (execError.stdout ?? "") + (execError.stderr ?? "");
        exitCode = execError.status ?? 1;
      }

      if (exitCode !== 0) {
        console.error("tsc output:\n", output);
      }
      expect(exitCode).toBe(0);
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------
// AC5 — npm run lint exits with code 0 (no new lint errors)
// ---------------------------------------------------------------------------
describe("AC5: npm run lint exits with code 0 (no lint errors)", () => {
  it(
    "npm run lint reports no errors in apps/frontend/",
    () => {
      let output = "";
      let exitCode = 0;
      try {
        output = execSync("npm run lint", {
          cwd: FRONTEND_ROOT,
          encoding: "utf-8",
          timeout: 120_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const execError = err as { stdout?: string; stderr?: string; status?: number };
        output = (execError.stdout ?? "") + (execError.stderr ?? "");
        exitCode = execError.status ?? 1;
      }

      if (exitCode !== 0) {
        console.error("lint output:\n", output);
      }
      expect(exitCode).toBe(0);
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------
// AC6 — The <Typography> in index.tsx does not use an inline style prop or
//        a raw CSS className for styling — only sx prop or MUI theme
// ---------------------------------------------------------------------------
describe("AC6: <Typography> in index.tsx uses no inline style prop or raw CSS className", () => {
  it("no Typography element uses an inline style={{ }} prop", () => {
    const src = readSrc("routes", "index.tsx");
    // Find all Typography opening tags and check for style= attribute
    const typographyOpenTags = [...src.matchAll(/<Typography([^>]*)>/g)].map((m) => m[1] ?? "");
    for (const attrs of typographyOpenTags) {
      expect(attrs, "Typography must not use an inline style prop").not.toMatch(/\bstyle\s*=/);
    }
  });

  it("no Typography element uses a className prop for styling", () => {
    const src = readSrc("routes", "index.tsx");
    const typographyOpenTags = [...src.matchAll(/<Typography([^>]*)>/g)].map((m) => m[1] ?? "");
    for (const attrs of typographyOpenTags) {
      expect(attrs, "Typography must not use a raw className prop").not.toMatch(/\bclassName\s*=/);
    }
  });
});

// ---------------------------------------------------------------------------
// AC7 — No locale file under apps/frontend/src/locales/ is missing the
//        translation key — grep for the key returns a match in every common.json
// ---------------------------------------------------------------------------
describe("AC7: grep for 'welcome' key returns a match in every common.json under src/locales/", () => {
  function findAllCommonJsonFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findAllCommonJsonFiles(fullPath));
      } else if (entry.isFile() && entry.name === "common.json") {
        results.push(fullPath);
      }
    }
    return results;
  }

  const localesDir = srcPath("locales");
  const commonJsonFiles = findAllCommonJsonFiles(localesDir);

  it("grep for 'welcome' returns a match in every common.json file", () => {
    for (const filePath of commonJsonFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(
        content,
        `Expected to find 'welcome' key in ${filePath}`,
      ).toMatch(/"welcome"/);
    }
  });

  it("the number of common.json files with 'welcome' key equals the total number of common.json files", () => {
    const filesWithKey = commonJsonFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      return /"welcome"/.test(content);
    });
    expect(filesWithKey.length).toBe(commonJsonFiles.length);
  });
});
