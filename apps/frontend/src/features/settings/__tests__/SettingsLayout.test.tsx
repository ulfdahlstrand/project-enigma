import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsLayout } from "../SettingsLayout";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({ children, to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

describe("SettingsLayout", () => {
  it("renders links for both settings sections and marks the active one", () => {
    render(
      <SettingsLayout activeSection="assistant-preferences">
        <div>Settings body</div>
      </SettingsLayout>,
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assistant preferences" })).toHaveAttribute("href", "/settings/assistant/preferences");
    expect(screen.getByRole("link", { name: "External AI Connections" })).toHaveAttribute("href", "/settings/assistant/external-ai");
    expect(screen.getByText("Settings body")).toBeInTheDocument();
  });
});
