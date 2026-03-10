/**
 * Tests for the /test route.
 *
 * Acceptance criteria covered:
 *   AC1 — test.heading in en/common.json is exactly "qwerty"
 *   AC2 — No other keys in en/common.json are added, removed, or modified
 *   AC3 — test.tsx renders heading via t("test.heading"), no hardcoded string in JSX
 *   AC4 — The rendered <h1> contains the text "qwerty" (using real en/common.json)
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils/render";
import enCommon from "../locales/en/common.json";
import testSourceRaw from "./test.tsx?raw";

// ---------------------------------------------------------------------------
// Mock the oRPC client — prevents real network calls in unit tests
// ---------------------------------------------------------------------------

vi.mock("../orpc-client", () => ({
  orpc: {
    listTestEntries: vi.fn().mockResolvedValue({ entries: [] }),
  },
}));

// ---------------------------------------------------------------------------
// Extract the TestPage component from the Route definition
// ---------------------------------------------------------------------------

import { Route } from "./test";
import React from "react";

const TestPage = Route.options.component as React.ComponentType;

// ---------------------------------------------------------------------------
// AC1 — test.heading value in en/common.json is exactly "qwerty"
// ---------------------------------------------------------------------------

describe("AC1 — test.heading value in en/common.json", () => {
  it('is exactly "qwerty"', () => {
    expect(enCommon.test.heading).toBe("qwerty");
  });
});

// ---------------------------------------------------------------------------
// AC2 — No other keys in en/common.json are added, removed, or modified
// (Snapshot of the full key set and all non-test.heading values)
// ---------------------------------------------------------------------------

describe("AC2 — No other keys in en/common.json changed", () => {
  it("retains all expected top-level keys", () => {
    const topLevelKeys = Object.keys(enCommon).sort();
    expect(topLevelKeys).toEqual(
      ["employee", "footer", "header", "nav", "test", "welcome"].sort()
    );
  });

  it("welcome value is unchanged", () => {
    expect(enCommon.welcome).toBe("Welcome to CV Tool");
  });

  it("header.appName is unchanged", () => {
    expect(enCommon.header.appName).toBe("CV Tool");
  });

  it("footer.copyright is unchanged", () => {
    expect(enCommon.footer.copyright).toBe("© CV Tool. All rights reserved.");
  });

  it("nav keys and values are unchanged", () => {
    expect(enCommon.nav).toEqual({
      home: "Home",
      test: "Test",
      employees: "Employees",
    });
  });

  it("all test.* keys other than heading are unchanged", () => {
    const { heading: _heading, ...otherTestKeys } = enCommon.test;
    expect(otherTestKeys).toEqual({
      description: "This page validates full end-to-end stack connectivity.",
      loading: "Loading entries…",
      error: "Failed to load entries. Please try again later.",
      empty: "No entries found.",
      tableHeaderId: "ID",
      tableHeaderName: "Name",
      tableHeaderNote: "Note",
    });
  });
});

// ---------------------------------------------------------------------------
// AC3 — test.tsx uses t("test.heading"), no hardcoded string in JSX
// ---------------------------------------------------------------------------

describe("AC3 — test.tsx renders heading via t('test.heading'), no hardcoded string", () => {
  it('calls t("test.heading") for the heading', () => {
    // Accepts both single and double quotes in the source
    expect(testSourceRaw).toMatch(/t\(["']test\.heading["']\)/);
  });

  it('does not contain a hardcoded "qwerty" string in JSX', () => {
    // Strip single-line comment lines to avoid false positives
    const codeLines = testSourceRaw
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("/*")
        );
      })
      .join("\n");
    expect(codeLines).not.toContain("qwerty");
  });
});

// ---------------------------------------------------------------------------
// AC4 — Rendered <h1> contains "qwerty" (using real en/common.json)
// ---------------------------------------------------------------------------

describe("AC4 — TestPage renders <h1> with text 'qwerty'", () => {
  it("renders a heading element containing 'qwerty'", async () => {
    renderWithProviders(<TestPage />);

    // The h1 is rendered synchronously — heading text does not depend on data loading
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("qwerty");
  });
});
