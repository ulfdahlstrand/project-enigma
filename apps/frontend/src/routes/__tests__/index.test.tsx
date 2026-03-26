/**
 * Tests for the "/" home page route.
 *
 * Acceptance criteria:
 *   - Renders the welcome heading
 *   - Renders the subtitle text
 *   - Renders an Employees action card with link to /employees
 *   - Renders a Resumes action card with link to /resumes
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders } from "../../test-utils/render";
import { Route } from "..";

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return (
        <a href={to} ref={ref} {...props}>
          {children}
        </a>
      );
    }),
  };
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const HomePage = Route.options.component as React.ComponentType;

function renderPage() {
  return renderWithProviders(<HomePage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomePage", () => {
  it("renders the welcome heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: enCommon.home.welcome })).toBeInTheDocument();
  });

  it("renders the subtitle text", () => {
    renderPage();
    expect(screen.getByText(enCommon.home.subtitle)).toBeInTheDocument();
  });

  it("renders the Employees card title", () => {
    renderPage();
    expect(screen.getByText(enCommon.home.employeesCard.title)).toBeInTheDocument();
  });

  it("renders the Employees card description", () => {
    renderPage();
    expect(screen.getByText(enCommon.home.employeesCard.description)).toBeInTheDocument();
  });

  it("renders a link to /employees", () => {
    renderPage();
    const links = screen.getAllByRole("link");
    const employeesLink = links.find((l) => l.getAttribute("href") === "/employees");
    expect(employeesLink).toBeDefined();
  });

  it("renders the Resumes card title", () => {
    renderPage();
    expect(screen.getByText(enCommon.home.resumesCard.title)).toBeInTheDocument();
  });

  it("renders the Resumes card description", () => {
    renderPage();
    expect(screen.getByText(enCommon.home.resumesCard.description)).toBeInTheDocument();
  });

  it("renders a link to /resumes", () => {
    renderPage();
    const links = screen.getAllByRole("link");
    const resumesLink = links.find((l) => l.getAttribute("href") === "/resumes");
    expect(resumesLink).toBeDefined();
  });
});
