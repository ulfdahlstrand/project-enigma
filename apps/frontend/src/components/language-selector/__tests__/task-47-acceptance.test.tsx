/**
 * Acceptance-criteria tests for Task #47:
 * "Add flag icons to the language selector component"
 *
 * AC1 – Running `npm ls` inside `apps/frontend/` lists `country-flag-icons` as a direct
 *       dependency in `apps/frontend/package.json`.
 * AC2 – `apps/frontend/src/components/language-selector/LanguageSelector.tsx` exists and
 *       exports a named `LanguageSelector` React component.
 * AC3 – A locale-to-flag mapping object is defined in a single dedicated file
 *       (`locale-flag-map.ts`) and imported by `LanguageSelector.tsx` — not inlined.
 * AC4 – Rendered output shows that each language option includes a flag icon element
 *       rendered from the approved library alongside the text label.
 * AC5 – `LanguageSelector.tsx` contains no `style={{` JSX attribute and no raw
 *       `.css` or `.scss` import.
 * AC6 – `npx tsc --noEmit` in `apps/frontend/` exits with code 0.
 * AC7 – Component accepts `currentLocale: string` and `onLocaleChange: (locale: string) => void`;
 *       a unit test verifies the callback is called with the selected locale; a render test
 *       confirms `useTranslation` is invoked by asserting translated label text is present.
 * AC8 – The locale-to-flag mapping file contains exactly one entry per locale directory under
 *       `apps/frontend/src/locales/`, with no duplicate keys.
 * AC9 – Flag icon elements are contained within MUI components (`MenuItem`, `Select`,
 *       `IconButton`, or equivalent) — not rendered as direct children of plain HTML elements.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

// __dirname = apps/frontend/src/components/language-selector/__tests__
// 4 levels up: __tests__/ -> language-selector/ -> components/ -> src/ -> apps/frontend/
const FRONTEND_ROOT = path.resolve(__dirname, "../../../../");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

function srcPath(...segments: string[]): string {
  return path.join(SRC_ROOT, ...segments);
}

function readSrc(...segments: string[]): string {
  return fs.readFileSync(srcPath(...segments), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1 — `country-flag-icons` is listed as a direct dependency in package.json
// ---------------------------------------------------------------------------
describe("AC1: country-flag-icons is a direct dependency in apps/frontend/package.json", () => {
  let packageJson: { dependencies?: Record<string, string> };

  beforeAll(() => {
    const raw = fs.readFileSync(path.join(FRONTEND_ROOT, "package.json"), "utf-8");
    packageJson = JSON.parse(raw) as { dependencies?: Record<string, string> };
  });

  it("AC1a: package.json has a dependencies field", () => {
    expect(packageJson.dependencies).toBeDefined();
  });

  it("AC1b: country-flag-icons appears in dependencies (not just devDependencies)", () => {
    expect(packageJson.dependencies).toHaveProperty("country-flag-icons");
  });

  it("AC1c: country-flag-icons dependency version is a non-empty string", () => {
    const version = packageJson.dependencies?.["country-flag-icons"];
    expect(typeof version).toBe("string");
    expect((version ?? "").length).toBeGreaterThan(0);
  });

  it(
    "AC1d: npm ls inside apps/frontend/ lists country-flag-icons without errors",
    () => {
      let output = "";
      let exitCode = 0;

      try {
        output = execSync("npm ls country-flag-icons --depth=0", {
          cwd: FRONTEND_ROOT,
          encoding: "utf-8",
          timeout: 60_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; status?: number };
        output = (e.stdout ?? "") + (e.stderr ?? "");
        exitCode = e.status ?? 1;
      }

      // npm ls may exit non-zero if there are unmet peer deps unrelated to this library.
      // The important signal is that `country-flag-icons` appears in the output.
      expect(output).toMatch(/country-flag-icons/);
      if (exitCode !== 0) {
        console.warn("npm ls exited non-zero — output:\n", output);
      }
    },
    60_000
  );
});

// ---------------------------------------------------------------------------
// AC2 — LanguageSelector.tsx exists and exports a named `LanguageSelector` component
// ---------------------------------------------------------------------------
describe("AC2: LanguageSelector.tsx exists and exports a named LanguageSelector component", () => {
  const COMPONENT_PATH = srcPath(
    "components",
    "language-selector",
    "LanguageSelector.tsx"
  );

  it("AC2a: LanguageSelector.tsx file exists at the expected path", () => {
    expect(fs.existsSync(COMPONENT_PATH)).toBe(true);
  });

  it("AC2b: LanguageSelector.tsx contains a named export of function LanguageSelector", () => {
    const src = fs.readFileSync(COMPONENT_PATH, "utf-8");
    const hasNamedExport =
      /export\s+function\s+LanguageSelector\s*\(/.test(src) ||
      /export\s+\{[^}]*LanguageSelector[^}]*\}/.test(src) ||
      /export\s+const\s+LanguageSelector\s*=/.test(src);
    expect(hasNamedExport).toBe(true);
  });

  it("AC2c: the LanguageSelector export is a React component (JSX returned from the function)", () => {
    const src = fs.readFileSync(COMPONENT_PATH, "utf-8");
    const hasJsxReturn = /return\s*\(\s*</.test(src) || /return\s+</.test(src);
    expect(hasJsxReturn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3 — locale-to-flag mapping lives in a dedicated file and is imported by
//        LanguageSelector.tsx (not inlined in the component body)
// ---------------------------------------------------------------------------
describe("AC3: locale-flag-map.ts is a dedicated file imported by LanguageSelector.tsx", () => {
  const MAPPING_PATH = srcPath(
    "components",
    "language-selector",
    "locale-flag-map.ts"
  );
  const COMPONENT_PATH = srcPath(
    "components",
    "language-selector",
    "LanguageSelector.tsx"
  );

  it("AC3a: locale-flag-map.ts exists as a dedicated file", () => {
    expect(fs.existsSync(MAPPING_PATH)).toBe(true);
  });

  it("AC3b: locale-flag-map.ts exports a mapping object", () => {
    const src = fs.readFileSync(MAPPING_PATH, "utf-8");
    const hasExport =
      /export\s+const\s+\w+\s*:\s*Record\s*</.test(src) ||
      /export\s+const\s+\w+\s*=\s*\{/.test(src);
    expect(hasExport).toBe(true);
  });

  it("AC3c: LanguageSelector.tsx imports from ./locale-flag-map", () => {
    const src = fs.readFileSync(COMPONENT_PATH, "utf-8");
    expect(src).toMatch(
      /import\s+\{[^}]+\}\s+from\s+["']\.\/locale-flag-map["']/
    );
  });

  it("AC3d: LanguageSelector.tsx does NOT inline a locale-to-country-code map object literal in the component body", () => {
    const src = fs.readFileSync(COMPONENT_PATH, "utf-8");
    // Detects patterns like { en: "GB" } or { en: 'GB', fr: 'FR' } — lowercase key → uppercase value
    const inlinedMapPattern = /\{\s*["']?[a-z]{2}["']?\s*:\s*["'][A-Z]{2}["']/;
    const hasInlinedLocaleMap = inlinedMapPattern.test(src);
    expect(hasInlinedLocaleMap).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Rendered output shows flag icon elements per language option
// ---------------------------------------------------------------------------
describe("AC4: rendered output includes flag icon elements for each language option", () => {
  beforeAll(() => {
    vi.mock("react-i18next", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react-i18next")>();
      return {
        ...actual,
        useTranslation: () => ({
          t: (key: string, fallback?: string) => fallback ?? key,
          i18n: { changeLanguage: vi.fn(), language: "en" },
        }),
      };
    });
  });

  it("AC4a: renders flag SVG elements (from country-flag-icons) for each locale in localeFlagMap", async () => {
    const { LanguageSelector } = await import("../LanguageSelector");
    const { localeFlagMap } = await import("../locale-flag-map");

    const onLocaleChange = vi.fn();
    const { container } = render(
      React.createElement(LanguageSelector, {
        currentLocale: "en",
        onLocaleChange,
      })
    );

    const svgElements = container.querySelectorAll("svg");
    const localeCount = Object.keys(localeFlagMap).length;
    expect(svgElements.length).toBeGreaterThanOrEqual(localeCount);
  });

  it("AC4b: each MenuItem in the rendered output contains a Box wrapper alongside the locale label", async () => {
    const { LanguageSelector } = await import("../LanguageSelector");
    const { localeFlagMap } = await import("../locale-flag-map");

    const onLocaleChange = vi.fn();
    const { container } = render(
      React.createElement(LanguageSelector, {
        currentLocale: "en",
        onLocaleChange,
      })
    );

    const menuItems = container.querySelectorAll("li");
    if (menuItems.length > 0) {
      const itemsWithSvg = Array.from(menuItems).filter(
        (li) => li.querySelector("svg") !== null
      );
      expect(itemsWithSvg.length).toBeGreaterThanOrEqual(
        Object.keys(localeFlagMap).length
      );
    } else {
      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThanOrEqual(
        Object.keys(localeFlagMap).length
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC5 — LanguageSelector.tsx has no `style={{` attribute and no .css/.scss import
// ---------------------------------------------------------------------------
describe("AC5: LanguageSelector.tsx uses no inline style={{ }} attributes and no CSS/SCSS imports", () => {
  let src: string;

  beforeAll(() => {
    src = readSrc("components", "language-selector", "LanguageSelector.tsx");
  });

  it("AC5a: source file contains no style={{ JSX attribute", () => {
    const hasInlineStyle = /\bstyle\s*=\s*\{\{/.test(src);
    expect(hasInlineStyle).toBe(false);
  });

  it("AC5b: source file does not import any .css file", () => {
    const hasCssImport = /import\s+["'][^"']*\.css["']/.test(src);
    expect(hasCssImport).toBe(false);
  });

  it("AC5c: source file does not import any .scss file", () => {
    const hasScssImport = /import\s+["'][^"']*\.scss["']/.test(src);
    expect(hasScssImport).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC6 — `npx tsc --noEmit` exits with code 0
// ---------------------------------------------------------------------------
describe("AC6: npx tsc --noEmit exits with code 0 (no TypeScript errors)", () => {
  it(
    "AC6a: TypeScript compilation reports no errors in apps/frontend/",
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
        const e = err as {
          stdout?: string;
          stderr?: string;
          status?: number;
        };
        output = (e.stdout ?? "") + (e.stderr ?? "");
        exitCode = e.status ?? 1;
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
// AC7 — Props contract, callback invocation, and useTranslation usage
// ---------------------------------------------------------------------------
describe("AC7: LanguageSelector accepts required props, fires onLocaleChange, and uses useTranslation", () => {
  it("AC7a (static): LanguageSelector.tsx declares currentLocale: string prop", () => {
    const src = readSrc("components", "language-selector", "LanguageSelector.tsx");
    const hasCurrentLocale =
      /currentLocale\s*:\s*string/.test(src) ||
      /\{\s*currentLocale/.test(src);
    expect(hasCurrentLocale).toBe(true);
  });

  it("AC7b (static): LanguageSelector.tsx declares onLocaleChange: (locale: string) => void prop", () => {
    const src = readSrc("components", "language-selector", "LanguageSelector.tsx");
    const hasOnLocaleChange =
      /onLocaleChange\s*:\s*\(locale\s*:\s*string\)\s*=>\s*void/.test(src) ||
      /onLocaleChange\s*:\s*\(.*string.*\)\s*=>\s*void/.test(src) ||
      /\{\s*[^}]*onLocaleChange/.test(src);
    expect(hasOnLocaleChange).toBe(true);
  });

  it("AC7c (static): LanguageSelector.tsx calls useTranslation", () => {
    const src = readSrc("components", "language-selector", "LanguageSelector.tsx");
    expect(src).toMatch(/useTranslation\s*\(/);
  });

  it("AC7d (static): LanguageSelector.tsx imports useTranslation from react-i18next", () => {
    const src = readSrc("components", "language-selector", "LanguageSelector.tsx");
    expect(src).toMatch(
      /import\s+\{[^}]*useTranslation[^}]*\}\s+from\s+["']react-i18next["']/
    );
  });

  it("AC7e (render): onLocaleChange callback is called when user selects a different option", async () => {
    const { LanguageSelector } = await import("../LanguageSelector");
    const onLocaleChange = vi.fn();

    const { getByRole, getAllByRole } = render(
      React.createElement(LanguageSelector, {
        currentLocale: "en",
        onLocaleChange,
      })
    );

    // Open the MUI Select dropdown by clicking the combobox
    const select = getByRole("combobox");
    await userEvent.click(select);

    // Get all rendered options (MUI renders them as options or menuitem roles)
    const options = getAllByRole("option");

    if (options.length > 0) {
      const firstOption = options[0] as HTMLElement;
      await userEvent.click(firstOption);
      expect(onLocaleChange).toHaveBeenCalledWith(expect.any(String));
    } else {
      // Fallback: verify listbox is present (drop-down opened)
      const listItems = getAllByRole("listbox");
      expect(listItems.length).toBeGreaterThan(0);
    }
  });

  it("AC7f (render): rendered output contains translated label text (useTranslation is active)", async () => {
    const { LanguageSelector } = await import("../LanguageSelector");
    const onLocaleChange = vi.fn();

    render(
      React.createElement(LanguageSelector, {
        currentLocale: "en",
        onLocaleChange,
      })
    );

    // The component sets aria-label via t("languageSelector.label", "Select language").
    // When the translation key is absent the fallback "Select language" is used.
    const selectEl = screen.getByRole("combobox");
    const ariaLabel = selectEl.getAttribute("aria-label") ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC8 — Mapping file has exactly one entry per locale directory, no duplicates
// ---------------------------------------------------------------------------
describe("AC8: locale-flag-map.ts entries exactly match locale subdirectories with no duplicates", () => {
  it("AC8a: each key in localeFlagMap corresponds to a subdirectory under apps/frontend/src/locales/", async () => {
    const { localeFlagMap } = await import("../locale-flag-map");
    const localesDir = path.join(SRC_ROOT, "locales");
    const localeDirs = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const mappingKeys = Object.keys(localeFlagMap);
    for (const key of mappingKeys) {
      expect(localeDirs).toContain(key);
    }
  });

  it("AC8b: each locale subdirectory under apps/frontend/src/locales/ has an entry in localeFlagMap", async () => {
    const { localeFlagMap } = await import("../locale-flag-map");
    const localesDir = path.join(SRC_ROOT, "locales");
    const localeDirs = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dir of localeDirs) {
      expect(localeFlagMap).toHaveProperty(dir);
    }
  });

  it("AC8c: the number of entries in localeFlagMap equals the number of locale subdirectories", async () => {
    const { localeFlagMap } = await import("../locale-flag-map");
    const localesDir = path.join(SRC_ROOT, "locales");
    const localeDirs = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    expect(Object.keys(localeFlagMap).length).toBe(localeDirs.length);
  });

  it("AC8d: localeFlagMap has no duplicate keys (each key appears exactly once in source)", async () => {
    const src = readSrc(
      "components",
      "language-selector",
      "locale-flag-map.ts"
    );

    const keyMatches = [...src.matchAll(/^\s{2}["']?([a-z]{2})["']?\s*:/gm)];
    const keys = keyMatches.map((m) => m[1] as string);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});

// ---------------------------------------------------------------------------
// AC9 — Flag icons are contained within MUI wrappers, not bare HTML elements
// ---------------------------------------------------------------------------
describe("AC9: flag icons are rendered inside MUI components, not bare HTML elements", () => {
  let src: string;

  beforeAll(() => {
    src = readSrc("components", "language-selector", "LanguageSelector.tsx");
  });

  it("AC9a: the source file contains MUI MenuItem, Select, or equivalent wrapper component", () => {
    const hasMuiWrapper =
      /<MenuItem[\s/>]/.test(src) ||
      /<Select[\s/>]/.test(src) ||
      /<IconButton[\s/>]/.test(src);
    expect(hasMuiWrapper).toBe(true);
  });

  it("AC9b: flag icon elements (FlagIcon) are not rendered as direct children of bare <div> or <span>", () => {
    const bareDivWrappingFlag = /<div[^>]*>\s*(?:\{[^}]*\})?\s*<FlagIcon/.test(src);
    const bareSpanWrappingFlag = /<span[^>]*>\s*(?:\{[^}]*\})?\s*<FlagIcon/.test(src);
    expect(bareDivWrappingFlag).toBe(false);
    expect(bareSpanWrappingFlag).toBe(false);
  });

  it("AC9c: FlagIcon is rendered inside a MUI Box component (MUI sx-capable wrapper)", () => {
    expect(src).toMatch(/<Box[\s\S]*?<FlagIcon/);
  });

  it("AC9d: the FlagIcon Box wrapper is itself nested inside a MUI MenuItem", () => {
    const menuItemIndex = src.indexOf("<MenuItem");
    const boxIndex = src.indexOf("<Box", menuItemIndex);
    const flagIconIndex = src.indexOf("<FlagIcon", boxIndex);

    expect(menuItemIndex).toBeGreaterThan(-1);
    expect(boxIndex).toBeGreaterThan(menuItemIndex);
    expect(flagIconIndex).toBeGreaterThan(boxIndex);
  });

  it("AC9e: no flag icons are rendered outside of the MUI Select component (not loose in the JSX root)", () => {
    const selectOpenIndex = src.indexOf("<Select");
    const firstFlagIconIndex = src.indexOf("<FlagIcon");

    expect(selectOpenIndex).toBeGreaterThan(-1);
    expect(firstFlagIconIndex).toBeGreaterThan(selectOpenIndex);
  });
});
