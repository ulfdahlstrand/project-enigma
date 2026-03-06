/**
 * Acceptance-criteria tests for Task #46:
 * "Move language selector into Header.tsx and remove it from the index route"
 *
 * AC1 – Header.tsx imports LanguageSelector and renders it inside Toolbar, right-aligned
 *       via Box with sx={{ marginLeft: 'auto' }} or equivalent flexGrow spacer.
 * AC2 – index.tsx contains no import statement referencing the language selector component.
 * AC3 – index.tsx contains no JSX rendering of the language selector component.
 * AC4 – npm run typecheck exits with code 0 (no TypeScript errors).
 * AC5 – npm run build exits with code 0 (no build errors).
 * AC6 – All styling on the language selector's wrapper in Header.tsx uses only MUI sx prop
 *       (no raw CSS files, inline style objects, or standalone styled() calls).
 * AC7 – The LanguageSelector component file is unmodified by this task: it is a newly
 *       created file (did not exist before), so git diff HEAD shows only additions with
 *       no deletions — meaning its internal logic was not altered after creation.
 *
 * All criteria are verified by static file inspection or CLI commands.
 * No rendering/DOM tests are needed because the criteria are fully binary at the file level.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

// __dirname = apps/frontend/src/components/layout/__tests__
// Resolve up to the apps/frontend root (4 directories up)
const FRONTEND_ROOT = path.resolve(__dirname, "../../../../");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

function srcPath(...segments: string[]): string {
  return path.join(SRC_ROOT, ...segments);
}

function readSrc(...segments: string[]): string {
  return fs.readFileSync(srcPath(...segments), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1 — Header.tsx imports LanguageSelector and renders it inside Toolbar,
//        right-aligned via Box with sx={{ marginLeft: 'auto' }} or flexGrow spacer
// ---------------------------------------------------------------------------
describe("AC1: Header.tsx imports and renders LanguageSelector inside Toolbar with right-alignment", () => {
  let headerSrc: string;

  beforeAll(() => {
    headerSrc = readSrc("components", "layout", "Header.tsx");
  });

  it("AC1a: Header.tsx imports Box from @mui/material/Box", () => {
    expect(headerSrc).toMatch(
      /import\s+Box\s+from\s+["']@mui\/material\/Box["']/
    );
  });

  it("AC1b: Header.tsx imports Toolbar from @mui/material/Toolbar", () => {
    expect(headerSrc).toMatch(
      /import\s+Toolbar\s+from\s+["']@mui\/material\/Toolbar["']/
    );
  });

  it("AC1c: Header.tsx imports LanguageSelector from the layout directory", () => {
    // Matches: import { LanguageSelector } from "./LanguageSelector" (or similar relative path)
    expect(headerSrc).toMatch(
      /import\s+\{[^}]*LanguageSelector[^}]*\}\s+from\s+["'][^"']*LanguageSelector["']/
    );
  });

  it("AC1d: Header.tsx renders a <Toolbar> JSX element", () => {
    expect(headerSrc).toMatch(/<Toolbar[\s>]/);
  });

  it("AC1e: Header.tsx renders <LanguageSelector /> as a JSX element", () => {
    expect(headerSrc).toMatch(/<LanguageSelector\s*\/>/);
  });

  it("AC1f: Header.tsx wraps LanguageSelector in a Box with sx={{ marginLeft: 'auto' }} for right-alignment", () => {
    // The Box element must include marginLeft: "auto" or marginLeft: 'auto' in its sx prop
    // OR a flexGrow-based spacer is used — check for marginLeft: "auto" (the documented approach)
    const hasMarginLeftAuto =
      /marginLeft\s*:\s*["']auto["']/.test(headerSrc) ||
      /ml\s*:\s*["']auto["']/.test(headerSrc);
    expect(hasMarginLeftAuto).toBe(true);
  });

  it("AC1g: The Box containing LanguageSelector appears inside the Toolbar block", () => {
    // Check that <Box and <LanguageSelector both appear after the <Toolbar opening tag
    const toolbarOpenIndex = headerSrc.indexOf("<Toolbar");
    const boxIndex = headerSrc.indexOf("<Box", toolbarOpenIndex);
    const selectorIndex = headerSrc.indexOf("<LanguageSelector", toolbarOpenIndex);
    expect(toolbarOpenIndex).toBeGreaterThan(-1);
    expect(boxIndex).toBeGreaterThan(toolbarOpenIndex);
    expect(selectorIndex).toBeGreaterThan(toolbarOpenIndex);
  });
});

// ---------------------------------------------------------------------------
// AC2 — index.tsx contains no import statement referencing the language selector
// ---------------------------------------------------------------------------
describe("AC2: index.tsx contains no import statement referencing the language selector", () => {
  let indexSrc: string;

  beforeAll(() => {
    indexSrc = readSrc("routes", "index.tsx");
  });

  it("AC2a: no import line references 'LanguageSelector'", () => {
    // Match import statements containing LanguageSelector
    const hasLanguageSelectorImport =
      /^import\b.*LanguageSelector/m.test(indexSrc);
    expect(hasLanguageSelectorImport).toBe(false);
  });

  it("AC2b: no import line references 'language-selector' (kebab-case filename)", () => {
    const hasKebabImport = /^import\b.*language-selector/m.test(indexSrc);
    expect(hasKebabImport).toBe(false);
  });

  it("AC2c: no import line references 'languageSelector' (camelCase identifier)", () => {
    const hasCamelImport = /^import\b.*languageSelector/m.test(indexSrc);
    expect(hasCamelImport).toBe(false);
  });

  it("AC2d: grep-level check — none of the selector search terms appear in the import section of index.tsx", () => {
    // Comprehensive check: the terms LanguageSelector, language-selector, languageSelector
    // must not appear anywhere in the file (covers imports and JSX together — see also AC3)
    const hasAnyReference =
      /LanguageSelector|language-selector|languageSelector/.test(indexSrc);
    expect(hasAnyReference).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC3 — index.tsx contains no JSX rendering of the language selector component
// ---------------------------------------------------------------------------
describe("AC3: index.tsx contains no JSX rendering of the language selector", () => {
  let indexSrc: string;

  beforeAll(() => {
    indexSrc = readSrc("routes", "index.tsx");
  });

  it("AC3a: no JSX element named LanguageSelector is rendered", () => {
    const hasJsx = /<LanguageSelector[\s/>]/.test(indexSrc);
    expect(hasJsx).toBe(false);
  });

  it("AC3b: no JSX element named languageSelector (camelCase) is rendered", () => {
    const hasJsx = /<languageSelector[\s/>]/.test(indexSrc);
    expect(hasJsx).toBe(false);
  });

  it("AC3c: no self-closing or opening LanguageSelector tag is present", () => {
    // This is the same grep the criterion specifies; already covered by AC2d but
    // explicitly asserted here for each criterion's traceability
    const grepPattern = /LanguageSelector|language-selector|languageSelector/;
    expect(grepPattern.test(indexSrc)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4 — npm run typecheck exits with code 0 (no TypeScript errors)
// ---------------------------------------------------------------------------
describe("AC4: npm run typecheck exits with code 0 (no TypeScript errors)", () => {
  it(
    "AC4a: tsc --noEmit reports no errors in apps/frontend/",
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
        const execError = err as {
          stdout?: string;
          stderr?: string;
          status?: number;
        };
        output = (execError.stdout ?? "") + (execError.stderr ?? "");
        exitCode = execError.status ?? 1;
      }

      if (exitCode !== 0) {
        console.error("tsc --noEmit output:\n", output);
      }

      expect(exitCode).toBe(0);
    },
    120_000
  );
});

// ---------------------------------------------------------------------------
// AC5 — npm run build exits with code 0 (no build errors)
// ---------------------------------------------------------------------------
describe("AC5: npm run build exits with code 0 (no build errors)", () => {
  it(
    "AC5a: npm run build completes without errors from the repo root",
    () => {
      // Resolve from FRONTEND_ROOT up to the monorepo root (2 directories up from apps/frontend)
      const REPO_ROOT = path.resolve(FRONTEND_ROOT, "../../");
      let output = "";
      let exitCode = 0;

      try {
        output = execSync("npm run build", {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          timeout: 300_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const execError = err as {
          stdout?: string;
          stderr?: string;
          status?: number;
        };
        output = (execError.stdout ?? "") + (execError.stderr ?? "");
        exitCode = execError.status ?? 1;
      }

      if (exitCode !== 0) {
        console.error("npm run build output:\n", output);
      }

      expect(exitCode).toBe(0);
    },
    300_000
  );
});

// ---------------------------------------------------------------------------
// AC6 — Styling on the language selector's wrapper in Header.tsx uses only
//        MUI sx prop (no raw CSS files, inline style objects, or standalone styled() calls)
// ---------------------------------------------------------------------------
describe("AC6: Header.tsx uses only MUI sx prop for language selector wrapper styling", () => {
  let headerSrc: string;

  beforeAll(() => {
    headerSrc = readSrc("components", "layout", "Header.tsx");
  });

  it("AC6a: Header.tsx does not import any .css file", () => {
    const hasCssImport = /import\s+["'][^"']*\.css["']/.test(headerSrc);
    expect(hasCssImport).toBe(false);
  });

  it("AC6b: The Box wrapping LanguageSelector does not use an inline style={{ }} prop", () => {
    // Find the Box element that wraps LanguageSelector and check for inline style prop
    // We check the entire file for any style={{ pattern on a Box (conservative check)
    const boxBlocks = headerSrc.match(/<Box[\s\S]*?(?:\/>|>)/g) ?? [];
    const hasInlineStyle = boxBlocks.some((block) =>
      /\bstyle\s*=\s*\{/.test(block)
    );
    expect(hasInlineStyle).toBe(false);
  });

  it("AC6c: Header.tsx does not use a standalone styled() call wrapping LanguageSelector", () => {
    // styled() calls from @emotion/styled or @mui/material/styles are forbidden
    const hasStyledCall = /\bstyled\s*\(/.test(headerSrc);
    expect(hasStyledCall).toBe(false);
  });

  it("AC6d: The Box wrapper uses the sx prop for its marginLeft alignment", () => {
    // Confirm that the alignment is set via the sx prop (not via style= or className=)
    expect(headerSrc).toMatch(/sx\s*=\s*\{[^}]*marginLeft/);
  });
});

// ---------------------------------------------------------------------------
// AC7 — LanguageSelector component file is unmodified relative to what was
//        introduced in this task (new file — no deletions in git diff HEAD)
// ---------------------------------------------------------------------------
describe("AC7: LanguageSelector component file is unmodified (no post-creation alterations)", () => {
  const LANGUAGE_SELECTOR_PATH = srcPath(
    "components",
    "layout",
    "LanguageSelector.tsx"
  );

  it("AC7a: LanguageSelector.tsx exists at the expected path", () => {
    expect(fs.existsSync(LANGUAGE_SELECTOR_PATH)).toBe(true);
  });

  it("AC7b: LanguageSelector.tsx is a new file — git diff HEAD shows only additions (no deletions indicating post-creation edits)", () => {
    let diffOutput = "";
    let exitCode = 0;

    try {
      diffOutput = execSync(
        `git diff HEAD -- "${LANGUAGE_SELECTOR_PATH}"`,
        {
          cwd: FRONTEND_ROOT,
          encoding: "utf-8",
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
    } catch (err: unknown) {
      const execError = err as { stdout?: string; stderr?: string; status?: number };
      diffOutput = (execError.stdout ?? "") + (execError.stderr ?? "");
      exitCode = execError.status ?? 1;
    }

    // git diff HEAD on a committed new file shows nothing (clean working tree)
    // If there were deletions, lines starting with '-' (excluding ---) would be present
    const deletionLines = diffOutput
      .split("\n")
      .filter((line) => line.startsWith("-") && !line.startsWith("---"));

    if (exitCode !== 0) {
      console.error("git diff output:\n", diffOutput);
    }

    // The file must have no deletion lines — confirming its logic was not altered
    expect(deletionLines).toHaveLength(0);
  });

  it("AC7c: LanguageSelector.tsx does not import any external CSS file (internal logic unmodified)", () => {
    const src = fs.readFileSync(LANGUAGE_SELECTOR_PATH, "utf-8");
    const hasCssImport = /import\s+["'][^"']*\.css["']/.test(src);
    expect(hasCssImport).toBe(false);
  });

  it("AC7d: LanguageSelector.tsx exports a named function component called LanguageSelector", () => {
    const src = fs.readFileSync(LANGUAGE_SELECTOR_PATH, "utf-8");
    expect(src).toMatch(/export function LanguageSelector\s*\(/);
  });
});
