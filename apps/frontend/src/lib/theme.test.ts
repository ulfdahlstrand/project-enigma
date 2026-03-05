/**
 * Tests for Task #33 — Install and configure Material UI with ThemeProvider and CssBaseline
 *
 * Acceptance criteria verified:
 *   AC1  — @mui/material, @emotion/react, @emotion/styled listed as runtime dependencies
 *   AC2  — theme.ts exports a MUI theme object created via createTheme()
 *   AC3  — ThemeProvider wraps the app in App.tsx / __root.tsx with theme prop
 *   AC4  — CssBaseline is rendered as a direct child inside ThemeProvider
 *   AC5  — A code comment above the provider block documents the wrapping order
 *   AC8  — No *.css files introduced under apps/frontend/src/
 *   AC9  — No `any`, @ts-ignore, or @ts-expect-error in changed files
 *   AC10 — theme.ts contains only a bare createTheme() with no arguments / empty object
 *
 * ACs 6 (typecheck) and 7 (build) are exercised by running the project-level
 * typecheck and build commands; see the corresponding run_tests calls.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Vitest is invoked from apps/frontend/, so process.cwd() == apps/frontend/
const frontendRoot = process.cwd();
const frontendSrc = path.join(frontendRoot, "src");

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(frontendSrc, relPath), "utf-8");
}

function readFrontend(relPath: string): string {
  return fs.readFileSync(path.join(frontendRoot, relPath), "utf-8");
}

function fileExistsInSrc(relPath: string): boolean {
  return fs.existsSync(path.join(frontendSrc, relPath));
}

function findFilesRecursively(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursively(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// AC1 — package.json lists @mui/material, @emotion/react, @emotion/styled
//        as runtime dependencies
// ---------------------------------------------------------------------------

describe("AC1 — MUI packages listed as runtime dependencies in package.json", () => {
  it("lists @mui/material as a runtime dependency", () => {
    const pkg = JSON.parse(readFrontend("package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies!["@mui/material"]).toBeDefined();
  });

  it("lists @emotion/react as a runtime dependency", () => {
    const pkg = JSON.parse(readFrontend("package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies!["@emotion/react"]).toBeDefined();
  });

  it("lists @emotion/styled as a runtime dependency", () => {
    const pkg = JSON.parse(readFrontend("package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies!["@emotion/styled"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC2 — apps/frontend/src/lib/theme.ts exists and exports a MUI theme object
//        created via createTheme()
// ---------------------------------------------------------------------------

describe("AC2 — lib/theme.ts exists and exports a createTheme() result", () => {
  it("the file apps/frontend/src/lib/theme.ts exists", () => {
    expect(fileExistsInSrc("lib/theme.ts")).toBe(true);
  });

  it("theme.ts contains a createTheme() call", () => {
    const content = readSrc("lib/theme.ts");
    expect(content).toMatch(/createTheme\s*\(/);
  });

  it("theme.ts exports the result of createTheme()", () => {
    const content = readSrc("lib/theme.ts");
    // Matches: export const theme = createTheme() or export default createTheme()
    expect(content).toMatch(/export\s+(const\s+\w+\s*=\s*createTheme|default\s+createTheme)/);
  });

  it("the theme export is a valid MUI Theme object at runtime", async () => {
    const { theme } = await import("./theme");
    expect(theme).toBeDefined();
    // MUI theme objects carry these keys from createTheme
    expect(theme).toHaveProperty("palette");
    expect(theme).toHaveProperty("typography");
    expect(theme).toHaveProperty("spacing");
  });
});

// ---------------------------------------------------------------------------
// AC3 — ThemeProvider wraps the app in App.tsx (or __root.tsx) with the
//        theme prop bound to the export from theme.ts
// ---------------------------------------------------------------------------

describe("AC3 — ThemeProvider wraps the app with theme prop from theme.ts", () => {
  it("ThemeProvider appears in App.tsx", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/ThemeProvider/);
  });

  it("ThemeProvider is used as a JSX element in App.tsx", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/<ThemeProvider/);
  });

  it("ThemeProvider receives a theme prop in App.tsx", () => {
    const content = readSrc("App.tsx");
    // Matches theme={theme} or theme={anyIdentifier}
    expect(content).toMatch(/<ThemeProvider[^>]*theme=\{/);
  });

  it("theme.ts export is imported into App.tsx", () => {
    const content = readSrc("App.tsx");
    // Should import 'theme' from lib/theme (or ./lib/theme)
    expect(content).toMatch(/from\s+["'].*lib\/theme["']/);
  });

  it("ThemeProvider is imported from @mui/material/styles", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/from\s+["']@mui\/material\/styles["']/);
  });
});

// ---------------------------------------------------------------------------
// AC4 — CssBaseline is rendered as a direct child inside ThemeProvider
// ---------------------------------------------------------------------------

describe("AC4 — CssBaseline is rendered as a direct child inside ThemeProvider", () => {
  it("CssBaseline appears in App.tsx", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/CssBaseline/);
  });

  it("CssBaseline is used as a JSX element in App.tsx", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/<CssBaseline/);
  });

  it("CssBaseline appears between the ThemeProvider opening and closing tags", () => {
    const content = readSrc("App.tsx");
    const themeProviderOpen = content.indexOf("<ThemeProvider");
    const cssBaselinePos = content.indexOf("<CssBaseline");
    const themeProviderClose = content.lastIndexOf("</ThemeProvider>");
    expect(themeProviderOpen).toBeGreaterThanOrEqual(0);
    expect(cssBaselinePos).toBeGreaterThan(themeProviderOpen);
    expect(themeProviderClose).toBeGreaterThan(cssBaselinePos);
  });

  it("CssBaseline is imported from an @mui/material path", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/from\s+["']@mui\/material(\/CssBaseline)?["']/);
  });
});

// ---------------------------------------------------------------------------
// AC5 — A code comment above the provider block documents the wrapping order
// ---------------------------------------------------------------------------

describe("AC5 — Code comment documents the provider wrapping order", () => {
  it("App.tsx block comment mentions ThemeProvider as part of the provider order", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/\/\*[\s\S]*ThemeProvider[\s\S]*\*\//);
  });

  it("App.tsx block comment mentions CssBaseline as part of the provider order", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/\/\*[\s\S]*CssBaseline[\s\S]*\*\//);
  });

  it("App.tsx block comment mentions QueryClientProvider as part of the provider order", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/\/\*[\s\S]*QueryClientProvider[\s\S]*\*\//);
  });

  it("App.tsx block comment mentions RouterProvider as part of the provider order", () => {
    const content = readSrc("App.tsx");
    expect(content).toMatch(/\/\*[\s\S]*RouterProvider[\s\S]*\*\//);
  });

  it("the wrapping-order comment appears before the first <ThemeProvider JSX tag", () => {
    const content = readSrc("App.tsx");
    // Find the end of the last block comment before <ThemeProvider
    const themeProviderPos = content.indexOf("<ThemeProvider");
    const lastCommentEnd = content.lastIndexOf("*/", themeProviderPos);
    expect(lastCommentEnd).toBeGreaterThan(0);
    expect(lastCommentEnd).toBeLessThan(themeProviderPos);
  });
});

// ---------------------------------------------------------------------------
// AC8 — No *.css files introduced under apps/frontend/src/
// ---------------------------------------------------------------------------

describe("AC8 — No *.css files under apps/frontend/src/", () => {
  it("finds no .css files anywhere under apps/frontend/src/", () => {
    const cssFiles = findFilesRecursively(frontendSrc, /\.css$/);
    expect(cssFiles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC9 — No `any` type assertions and no @ts-ignore / @ts-expect-error in
//        files introduced or modified by this task
// ---------------------------------------------------------------------------

describe("AC9 — No `any`, @ts-ignore, or @ts-expect-error in changed files", () => {
  const changedFiles = [
    "App.tsx",
    "lib/theme.ts",
  ];

  for (const relPath of changedFiles) {
    it(`${relPath} contains no ': any' or 'as any' type assertion`, () => {
      const content = readSrc(relPath);
      const anyMatches = content.match(/:\s*any\b|as\s+any\b/g);
      expect(anyMatches).toBeNull();
    });

    it(`${relPath} contains no @ts-ignore comment`, () => {
      const content = readSrc(relPath);
      expect(content).not.toMatch(/@ts-ignore/);
    });

    it(`${relPath} contains no @ts-expect-error comment`, () => {
      const content = readSrc(relPath);
      expect(content).not.toMatch(/@ts-expect-error/);
    });
  }
});

// ---------------------------------------------------------------------------
// AC10 — theme.ts contains only a bare createTheme() call with no arguments
//         or an empty object — no custom palette/typography/branding overrides
// ---------------------------------------------------------------------------

describe("AC10 — theme.ts contains only a bare createTheme() with no overrides", () => {
  it("createTheme() is called with no arguments or an empty object literal only", () => {
    const content = readSrc("lib/theme.ts");
    // Accept: createTheme() or createTheme({})
    // Reject: createTheme({ palette: ... }) or createTheme({ typography: ... })
    expect(content).toMatch(/createTheme\s*\(\s*(\{\s*\})?\s*\)/);
  });

  it("theme.ts does not contain a 'palette' key override", () => {
    const content = readSrc("lib/theme.ts");
    expect(content).not.toMatch(/palette\s*:/);
  });

  it("theme.ts does not contain a 'typography' key override", () => {
    const content = readSrc("lib/theme.ts");
    expect(content).not.toMatch(/typography\s*:/);
  });

  it("theme.ts does not contain a 'spacing' key override", () => {
    const content = readSrc("lib/theme.ts");
    expect(content).not.toMatch(/spacing\s*:/);
  });

  it("theme.ts does not contain a 'components' key override", () => {
    const content = readSrc("lib/theme.ts");
    expect(content).not.toMatch(/components\s*:/);
  });
});
