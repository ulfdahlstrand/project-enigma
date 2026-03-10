/**
 * Tests for the /test route.
 *
 * Acceptance criteria covered:
 *   AC1 — test.heading in en/common.json is exactly "CV managing app"
 *   AC2 — No other keys in en/common.json are added, removed, or modified
 *   AC3 — test.tsx renders heading via t("test.heading") with no hardcoded "CV managing app" in JSX
 *   AC4 — Rendered <h1> contains "CV managing app" using real locale file and custom render utility
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils/render";

// Real locale file used for AC1, AC2 verification
import enCommon from "../locales/en/common.json";

// Source of test.tsx for static inspection (AC3)
import testRouteSourceRaw from "./test.tsx?raw";

// The component under test
import { Route } from "./test";

// ---------------------------------------------------------------------------
// Mock the oRPC client to prevent real network calls
// ---------------------------------------------------------------------------

vi.mock("../orpc-client", () => ({
  orpc: {
    listTestEntries: vi.fn(),
  },
}));

import { orpc } from "../orpc-client";

const mockListTestEntries = orpc.listTestEntries as ReturnType<typeof vi.fn>;

// Extract the page component from the Route definition
const TestPage = Route.options.component as React.ComponentType;

// ---------------------------------------------------------------------------
// AC1 — test.heading value in en/common.json is exactly "CV managing app"
// ---------------------------------------------------------------------------

describe("AC1 — test.heading in en/common.json is exactly 'CV managing app'", () => {
  it("has the value 'CV managing app' for the test.heading key", () => {
    expect(enCommon.test.heading).toBe("CV managing app");
  });
});

// ---------------------------------------------------------------------------
// AC2 — No other keys in en/common.json are added, removed, or modified
// (Snapshot of all top-level and nested keys to guard against accidental changes)
// ---------------------------------------------------------------------------

describe("AC2 — en/common.json structure is unchanged (only test.heading value updated)", () => {
  it("has exactly the expected top-level keys", () => {
    const topLevelKeys = Object.keys(enCommon).sort();
    expect(topLevelKeys).toEqual(
      ["employee", "footer", "header", "nav", "test", "welcome"].sort()
    );
  });

  it("has the expected keys under 'test'", () => {
    const testKeys = Object.keys(enCommon.test).sort();
    expect(testKeys).toEqual(
      [
        "description",
        "empty",
        "error",
        "heading",
        "loading",
        "tableHeaderId",
        "tableHeaderName",
        "tableHeaderNote",
      ].sort()
    );
  });

  it("has the expected keys under 'employee'", () => {
    const employeeKeys = Object.keys(enCommon.employee).sort();
    expect(employeeKeys).toEqual(
      [
        "addPerson",
        "detail",
        "empty",
        "error",
        "loading",
        "new",
        "pageDescription",
        "pageTitle",
        "tableHeaderEmail",
        "tableHeaderName",
      ].sort()
    );
  });

  it("has the expected keys under 'nav'", () => {
    const navKeys = Object.keys(enCommon.nav).sort();
    expect(navKeys).toEqual(["employees", "home", "test"].sort());
  });

  it("has the expected keys under 'header'", () => {
    const headerKeys = Object.keys(enCommon.header).sort();
    expect(headerKeys).toEqual(["appName"].sort());
  });

  it("has the expected keys under 'footer'", () => {
    const footerKeys = Object.keys(enCommon.footer).sort();
    expect(footerKeys).toEqual(["copyright"].sort());
  });

  it("retains unchanged non-heading values in 'test' section", () => {
    expect(enCommon.test.description).toBe(
      "This page validates full end-to-end stack connectivity."
    );
    expect(enCommon.test.loading).toBe("Loading entries…");
    expect(enCommon.test.error).toBe(
      "Failed to load entries. Please try again later."
    );
    expect(enCommon.test.empty).toBe("No entries found.");
    expect(enCommon.test.tableHeaderId).toBe("ID");
    expect(enCommon.test.tableHeaderName).toBe("Name");
    expect(enCommon.test.tableHeaderNote).toBe("Note");
  });
});

// ---------------------------------------------------------------------------
// AC3 — test.tsx renders heading via t("test.heading"); no hardcoded "CV managing app"
// ---------------------------------------------------------------------------

describe("AC3 — test.tsx uses t('test.heading') and has no hardcoded 'CV managing app' in JSX", () => {
  it('contains t("test.heading") in the source', () => {
    expect(testRouteSourceRaw).toContain('t("test.heading")');
  });

  it("does not contain the hardcoded string 'CV managing app' in the source", () => {
    expect(testRouteSourceRaw).not.toContain("CV managing app");
  });
});

// ---------------------------------------------------------------------------
// AC4 — Rendered <h1> contains "CV managing app" using real locale file
// ---------------------------------------------------------------------------

describe("AC4 — Rendered <h1> contains 'CV managing app' via real locale file and custom render utility", () => {
  it("displays 'CV managing app' in the h1 heading", () => {
    mockListTestEntries.mockResolvedValue({ entries: [] });

    renderWithProviders(<TestPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("CV managing app");
  });
});
