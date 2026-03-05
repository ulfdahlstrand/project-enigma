/**
 * Acceptance tests for Task #34
 * "Implement BaseLayout, Header, and Footer components with i18n and __root.tsx integration"
 *
 * All 12 acceptance criteria are verified here via static file inspection and
 * command execution. Tests are intentionally non-rendering (no DOM/jsdom needed)
 * since the criteria are specified as static inspection or CLI command checks.
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

// ---------------------------------------------------------------------------
// AC1 — BaseLayout.tsx exists and exports a named function component
// ---------------------------------------------------------------------------
describe("AC1: BaseLayout.tsx exists and exports a named BaseLayout function component", () => {
  it("file exists at apps/frontend/src/components/layout/BaseLayout.tsx", () => {
    expect(fs.existsSync(srcPath("components", "layout", "BaseLayout.tsx"))).toBe(true);
  });

  it("exports a named function component called BaseLayout", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/export function BaseLayout\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Header.tsx exists and exports a named function component
// ---------------------------------------------------------------------------
describe("AC2: Header.tsx exists and exports a named Header function component", () => {
  it("file exists at apps/frontend/src/components/layout/Header.tsx", () => {
    expect(fs.existsSync(srcPath("components", "layout", "Header.tsx"))).toBe(true);
  });

  it("exports a named function component called Header", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(src).toMatch(/export function Header\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Footer.tsx exists and exports a named function component
// ---------------------------------------------------------------------------
describe("AC3: Footer.tsx exists and exports a named Footer function component", () => {
  it("file exists at apps/frontend/src/components/layout/Footer.tsx", () => {
    expect(fs.existsSync(srcPath("components", "layout", "Footer.tsx"))).toBe(true);
  });

  it("exports a named function component called Footer", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(src).toMatch(/export function Footer\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Header.tsx renders MUI AppBar and Toolbar as JSX elements
// ---------------------------------------------------------------------------
describe("AC4: Header.tsx renders MUI AppBar and Toolbar JSX elements", () => {
  it("imports AppBar from @mui/material", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(src).toMatch(/import\s+AppBar\s+from\s+["']@mui\/material\/AppBar["']/);
  });

  it("imports Toolbar from @mui/material", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(src).toMatch(/import\s+Toolbar\s+from\s+["']@mui\/material\/Toolbar["']/);
  });

  it("uses <AppBar as a JSX element", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(src).toMatch(/<AppBar[\s>]/);
  });

  it("uses <Toolbar as a JSX element", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(src).toMatch(/<Toolbar[\s>]/);
  });
});

// ---------------------------------------------------------------------------
// AC5 — Footer.tsx renders MUI Box and Typography as JSX elements
// ---------------------------------------------------------------------------
describe("AC5: Footer.tsx renders MUI Box and Typography JSX elements", () => {
  it("imports Box from @mui/material", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(src).toMatch(/import\s+Box\s+from\s+["']@mui\/material\/Box["']/);
  });

  it("imports Typography from @mui/material", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(src).toMatch(/import\s+Typography\s+from\s+["']@mui\/material\/Typography["']/);
  });

  it("uses <Box as a JSX element", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(src).toMatch(/<Box[\s>]/);
  });

  it("uses <Typography as a JSX element", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(src).toMatch(/<Typography[\s>]/);
  });
});

// ---------------------------------------------------------------------------
// AC6 — BaseLayout.tsx renders <Header />, <Outlet />, and <Footer />
// ---------------------------------------------------------------------------
describe("AC6: BaseLayout.tsx JSX tree contains <Header />, <Outlet />, and <Footer />", () => {
  it("renders <Header />", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/<Header\s*\/>/);
  });

  it("renders <Footer />", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/<Footer\s*\/>/);
  });

  it("renders <Outlet />", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/<Outlet\s*\/>/);
  });

  it("imports Outlet from @tanstack/react-router", () => {
    const src = readSrc("components", "layout", "BaseLayout.tsx");
    expect(src).toMatch(/import\s+\{[^}]*Outlet[^}]*\}\s+from\s+["']@tanstack\/react-router["']/);
  });
});

// ---------------------------------------------------------------------------
// AC7 — __root.tsx renders <BaseLayout> as the route component
// ---------------------------------------------------------------------------
describe("AC7: __root.tsx uses BaseLayout as the root route component", () => {
  it("imports BaseLayout from the layout components directory", () => {
    const src = readSrc("routes", "__root.tsx");
    expect(src).toMatch(
      /import\s+\{[^}]*BaseLayout[^}]*\}\s+from\s+["'][^"']*components\/layout\/BaseLayout["']/,
    );
  });

  it("assigns BaseLayout as the route component", () => {
    const src = readSrc("routes", "__root.tsx");
    // Either: component: BaseLayout (direct) or component: () => <BaseLayout ...>
    expect(src).toMatch(/component\s*:\s*BaseLayout/);
  });
});

// ---------------------------------------------------------------------------
// AC8 — locales/en/common.json contains at least one translation key used by
//        Header and at least one used by Footer (non-empty string values)
// ---------------------------------------------------------------------------
describe("AC8: locales/en/common.json has non-empty translation keys for Header and Footer", () => {
  const commonJsonPath = srcPath("locales", "en", "common.json");

  it("locales/en/common.json file exists", () => {
    expect(fs.existsSync(commonJsonPath)).toBe(true);
  });

  it("contains a non-empty 'header' section with at least one string value", () => {
    const json = JSON.parse(fs.readFileSync(commonJsonPath, "utf-8")) as Record<string, unknown>;
    const header = json["header"] as Record<string, string> | undefined;
    expect(header).toBeDefined();
    const values = Object.values(header ?? {});
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values.every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });

  it("contains a non-empty 'footer' section with at least one string value", () => {
    const json = JSON.parse(fs.readFileSync(commonJsonPath, "utf-8")) as Record<string, unknown>;
    const footer = json["footer"] as Record<string, string> | undefined;
    expect(footer).toBeDefined();
    const values = Object.values(footer ?? {});
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values.every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });

  it("the key(s) referenced by Header via t('...') exist in common.json with non-empty values", () => {
    const headerSrc = readSrc("components", "layout", "Header.tsx");
    const keyMatches = [...headerSrc.matchAll(/t\(["']([^"']+)["']\)/g)].map((m) => m[1] as string);
    expect(keyMatches.length).toBeGreaterThanOrEqual(1);

    const json = JSON.parse(fs.readFileSync(commonJsonPath, "utf-8")) as Record<string, unknown>;
    for (const key of keyMatches) {
      const parts = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node: any = json;
      for (const part of parts) {
        expect(node, `Expected key path "${key}" to exist in common.json`).toHaveProperty(part);
        node = node[part];
      }
      expect(typeof node, `Value at key "${key}" should be a string`).toBe("string");
      expect((node as string).length, `Value at key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it("the key(s) referenced by Footer via t('...') exist in common.json with non-empty values", () => {
    const footerSrc = readSrc("components", "layout", "Footer.tsx");
    const keyMatches = [...footerSrc.matchAll(/t\(["']([^"']+)["']\)/g)].map((m) => m[1] as string);
    expect(keyMatches.length).toBeGreaterThanOrEqual(1);

    const json = JSON.parse(fs.readFileSync(commonJsonPath, "utf-8")) as Record<string, unknown>;
    for (const key of keyMatches) {
      const parts = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node: any = json;
      for (const part of parts) {
        expect(node, `Expected key path "${key}" to exist in common.json`).toHaveProperty(part);
        node = node[part];
      }
      expect(typeof node, `Value at key "${key}" should be a string`).toBe("string");
      expect((node as string).length, `Value at key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC9 — No bare string literals rendered directly in JSX in Header or Footer;
//        all user-facing strings use t('...')
// ---------------------------------------------------------------------------
describe("AC9: No bare string literals in JSX in Header or Footer; all strings use t('...')", () => {
  /**
   * Strategy: extract the JSX return block, remove all t('...') calls
   * (the allowed i18n pattern), then scan for remaining string content
   * rendered as text children — either plain text between tags or explicit
   * string expressions like {'hello'} or {"hello"}.
   */
  function hasBareLiteralInJsx(src: string): boolean {
    // Extract the JSX return block
    const returnMatch = src.match(/return\s*\(([\s\S]*)\)\s*;?\s*\}/);
    if (!returnMatch) return false;
    const jsx = returnMatch[1]!;

    // Remove all t("...") / t('...') wrapped in JSX expression braces — these are allowed
    const withoutT = jsx.replace(/\{\s*t\(["'][^"']*["']\)\s*\}/g, "");

    // Pattern 1: plain unquoted text between closing and opening tags with
    // at least one non-whitespace, non-numeric, letter or special char character.
    // Excludes pure whitespace and numeric-only content.
    const plainTextInTags = />\s*[A-Za-z©][^<{]*</;

    // Pattern 2: explicit JS string literal expressions in JSX children
    // e.g. {'some text'} or {"some text"}
    const stringExprInJsx = /\{\s*["'][^"']+["']\s*\}/;

    return plainTextInTags.test(withoutT) || stringExprInJsx.test(withoutT);
  }

  it("Header.tsx has no bare string literals in JSX (all strings use t('...'))", () => {
    const src = readSrc("components", "layout", "Header.tsx");
    expect(hasBareLiteralInJsx(src)).toBe(false);
  });

  it("Footer.tsx has no bare string literals in JSX (all strings use t('...'))", () => {
    const src = readSrc("components", "layout", "Footer.tsx");
    expect(hasBareLiteralInJsx(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC10 — No style={{ }} prop or .css import in BaseLayout, Header, or Footer
// ---------------------------------------------------------------------------
describe("AC10: No inline style prop or .css import in BaseLayout, Header, or Footer", () => {
  const components = [
    { name: "BaseLayout.tsx", segments: ["components", "layout", "BaseLayout.tsx"] as const },
    { name: "Header.tsx", segments: ["components", "layout", "Header.tsx"] as const },
    { name: "Footer.tsx", segments: ["components", "layout", "Footer.tsx"] as const },
  ];

  for (const { name, segments } of components) {
    it(`${name} does not use a style={{ }} inline style prop`, () => {
      const src = readSrc(...segments);
      expect(src).not.toMatch(/style=\s*\{\s*\{/);
    });

    it(`${name} does not import a .css file`, () => {
      const src = readSrc(...segments);
      expect(src).not.toMatch(/import\s+["'][^"']*\.css["']/);
    });
  }
});

// ---------------------------------------------------------------------------
// AC11 — npm run typecheck exits with code 0 (no TypeScript errors)
// ---------------------------------------------------------------------------
describe("AC11: npm run typecheck exits with code 0 (no TypeScript errors)", () => {
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
        console.error("typecheck output:\n", output);
      }
      expect(exitCode).toBe(0);
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------
// AC12 — .tsx extensions, PascalCase filenames, PascalCase named exports
// ---------------------------------------------------------------------------
describe("AC12: .tsx extensions, PascalCase filenames, PascalCase named exports", () => {
  const components = [
    { filename: "BaseLayout.tsx", exportName: "BaseLayout" },
    { filename: "Header.tsx", exportName: "Header" },
    { filename: "Footer.tsx", exportName: "Footer" },
  ];

  for (const { filename, exportName } of components) {
    it(`${filename} has a .tsx extension and PascalCase filename`, () => {
      // PascalCase: starts with uppercase, only letters, ends in .tsx
      expect(filename).toMatch(/^[A-Z][A-Za-z]+\.tsx$/);
      expect(fs.existsSync(srcPath("components", "layout", filename))).toBe(true);
    });

    it(`${filename} has a PascalCase named export: export function ${exportName}(`, () => {
      const src = readSrc("components", "layout", filename);
      const pattern = new RegExp(`export function ${exportName}\\s*\\(`);
      expect(src).toMatch(pattern);
    });
  }
});
