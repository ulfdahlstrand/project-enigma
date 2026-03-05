/**
 * Acceptance tests for Task #35
 * "Build NavigationMenu component with TanStack Router links and i18n labels"
 *
 * All 9 acceptance criteria are verified here via static file inspection and
 * CLI command execution. Tests are intentionally non-rendering (no DOM/jsdom
 * needed) because the criteria are all verifiable through static inspection or
 * CLI commands. This matches the convention established in task-34-acceptance.test.ts.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

// __dirname = apps/frontend/src/components/layout/__tests__
// Go up 4 levels: __tests__ -> layout -> components -> src -> frontend
const FRONTEND_ROOT = path.resolve(__dirname, "../../../../");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

function srcPath(...segments: string[]): string {
  return path.join(SRC_ROOT, ...segments);
}

function readSrc(...segments: string[]): string {
  return fs.readFileSync(srcPath(...segments), "utf-8");
}

function readCommonJson(): { nav?: { home?: string; test?: string } } {
  return JSON.parse(
    fs.readFileSync(srcPath("locales", "en", "common.json"), "utf-8"),
  ) as { nav?: { home?: string; test?: string } };
}

// ---------------------------------------------------------------------------
// AC1 — NavigationMenu.tsx exists and exports a named PascalCase component
// ---------------------------------------------------------------------------
describe("AC1: NavigationMenu.tsx exists and exports a named PascalCase NavigationMenu component", () => {
  it("file exists at apps/frontend/src/components/layout/NavigationMenu.tsx", () => {
    expect(
      fs.existsSync(srcPath("components", "layout", "NavigationMenu.tsx")),
    ).toBe(true);
  });

  it("exports a named function component called NavigationMenu", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/export function NavigationMenu\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — npx tsc --noEmit exits with code 0 (no TypeScript errors)
// ---------------------------------------------------------------------------
describe("AC2: npx tsc --noEmit exits with code 0 after NavigationMenu is added", () => {
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
    120_000,
  );
});

// ---------------------------------------------------------------------------
// AC3 — NavigationMenu renders an MUI List with exactly two ListItemButton elements
//        (one for "/" and one for "/test"), verifiable by static inspection
// ---------------------------------------------------------------------------
describe("AC3: NavigationMenu renders a List with exactly two ListItemButton elements for / and /test", () => {
  it("imports List from @mui/material/List", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/import\s+List\s+from\s+["']@mui\/material\/List["']/);
  });

  it("imports ListItemButton from @mui/material/ListItemButton", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(
      /import\s+ListItemButton\s+from\s+["']@mui\/material\/ListItemButton["']/,
    );
  });

  it("renders a <List as a JSX element", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/<List[\s>]/);
  });

  it("renders exactly two <ListItemButton occurrences in the JSX (one per route)", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    const matches = src.match(/<ListItemButton[\s>]/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it("includes a navigation item targeting route '/'", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    // to="/" attribute on Link or ListItemButton
    expect(src).toMatch(/to=["']\/["']/);
  });

  it("includes a navigation item targeting route '/test'", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    // to="/test" attribute
    expect(src).toMatch(/to=["']\/test["']/);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Each ListItemButton uses TanStack Router's <Link> — no hard-coded <a href>
// ---------------------------------------------------------------------------
describe("AC4: Navigation items use TanStack Router <Link>, no hard-coded <a href> attributes", () => {
  it("imports Link from @tanstack/react-router", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(
      /import\s+\{[^}]*Link[^}]*\}\s+from\s+["']@tanstack\/react-router["']/,
    );
  });

  it("uses the imported <Link component in JSX (either as component prop or as wrapper)", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    // Matches component={Link} or <Link to=...> usage
    expect(src).toMatch(/component=\{Link\}|<Link[\s>]/);
  });

  it("does not contain a hard-coded <a href='/'> or <a href='/test'> element", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    // No literal <a href="..."> or <a href='...'> elements
    expect(src).not.toMatch(/<a\s+href=["'][^"']*["']/i);
  });

  it("does not contain any <a href attribute at all (href-based anchors are forbidden)", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    // Should have zero hard-coded href= on an <a> tag
    expect(src).not.toMatch(/href=["'][^"']+["']/);
  });
});

// ---------------------------------------------------------------------------
// AC5 — Each navigation label is sourced from useTranslation('common') and
//        matches a key present in locales/en/common.json
// ---------------------------------------------------------------------------
describe("AC5: Navigation labels use useTranslation('common') and match keys in common.json", () => {
  it("calls useTranslation with the 'common' namespace", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/useTranslation\s*\(\s*["']common["']\s*\)/);
  });

  it("uses t('nav.home') as the label for the home navigation item", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/t\(["']nav\.home["']\)/);
  });

  it("uses t('nav.test') as the label for the test navigation item", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/t\(["']nav\.test["']\)/);
  });

  it("the key nav.home exists in locales/en/common.json with a non-empty string value", () => {
    const json = readCommonJson();
    expect(json.nav).toBeDefined();
    expect(typeof json.nav?.home).toBe("string");
    expect((json.nav?.home ?? "").length).toBeGreaterThan(0);
  });

  it("the key nav.test exists in locales/en/common.json with a non-empty string value", () => {
    const json = readCommonJson();
    expect(json.nav).toBeDefined();
    expect(typeof json.nav?.test).toBe("string");
    expect((json.nav?.test ?? "").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC6 — locales/en/common.json contains at least two new nav translation keys
// ---------------------------------------------------------------------------
describe("AC6: locales/en/common.json contains at least two navigation translation keys", () => {
  const commonJsonPath = srcPath("locales", "en", "common.json");

  it("locales/en/common.json exists", () => {
    expect(fs.existsSync(commonJsonPath)).toBe(true);
  });

  it("contains a 'nav' object with at least two keys", () => {
    const json = readCommonJson();
    expect(json.nav).toBeDefined();
    expect(Object.keys(json.nav ?? {}).length).toBeGreaterThanOrEqual(2);
  });

  it("nav.home key is present with a non-empty string value", () => {
    const json = readCommonJson();
    expect(typeof json.nav?.home).toBe("string");
    expect((json.nav?.home ?? "").length).toBeGreaterThan(0);
  });

  it("nav.test key is present with a non-empty string value", () => {
    const json = readCommonJson();
    expect(typeof json.nav?.test).toBe("string");
    expect((json.nav?.test ?? "").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC7 — BaseLayout imports and renders <NavigationMenu />
// ---------------------------------------------------------------------------
describe("AC7: BaseLayout imports and renders <NavigationMenu />", () => {
  it("BaseLayout.tsx imports NavigationMenu from the layout directory", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(
      /import\s+\{[^}]*NavigationMenu[^}]*\}\s+from\s+["'][^"']*NavigationMenu["']/,
    );
  });

  it("BaseLayout.tsx renders <NavigationMenu /> as a JSX element", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/<NavigationMenu\s*\/>/);
  });
});

// ---------------------------------------------------------------------------
// AC8 — No raw CSS files introduced; no inline style objects in NavigationMenu.tsx
//        or BaseLayout.tsx
// ---------------------------------------------------------------------------
describe("AC8: No raw CSS files and no inline style objects in NavigationMenu.tsx or BaseLayout.tsx", () => {
  it("NavigationMenu.tsx does not use a style={{ }} inline style prop", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).not.toMatch(/style=\s*\{\s*\{/);
  });

  it("NavigationMenu.tsx does not import a .css file", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).not.toMatch(/import\s+["'][^"']*\.css["']/);
  });

  it("BaseLayout.tsx does not use a style={{ }} inline style prop", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).not.toMatch(/style=\s*\{\s*\{/);
  });

  it("BaseLayout.tsx does not import a .css file", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).not.toMatch(/import\s+["'][^"']*\.css["']/);
  });

  it("no new .css files exist under apps/frontend/src/components/layout/", () => {
    const layoutDir = srcPath("components", "layout");
    const allFiles = fs.readdirSync(layoutDir);
    const cssFiles = allFiles.filter((f) => f.endsWith(".css"));
    expect(cssFiles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC9 — .tsx extension, PascalCase filename, PascalCase named export
// ---------------------------------------------------------------------------
describe("AC9: NavigationMenu uses .tsx extension, PascalCase filename, and PascalCase named export", () => {
  it("the file is named NavigationMenu.tsx (PascalCase, .tsx extension)", () => {
    const filename = "NavigationMenu.tsx";
    // Must start with uppercase, only letters, and end with .tsx
    expect(filename).toMatch(/^[A-Z][A-Za-z]+\.tsx$/);
    expect(
      fs.existsSync(srcPath("components", "layout", filename)),
    ).toBe(true);
  });

  it("the named export is PascalCase: export function NavigationMenu(", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).toMatch(/export function NavigationMenu\s*\(/);
  });

  it("there is no default export (named export only)", () => {
    const src = readSrc("components", "layout", "NavigationMenu.tsx");
    expect(src).not.toMatch(/export default/);
  });
});
