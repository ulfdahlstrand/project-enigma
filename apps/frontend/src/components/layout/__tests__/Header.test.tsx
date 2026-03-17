import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? "App",
      i18n: { changeLanguage: vi.fn(), language: "en" },
    }),
  };
});

import { Header } from "../Header";

describe("Header", () => {
  it("renders without crashing", () => {
    render(<Header />);
  });

  it("renders a language selector dropdown", () => {
    render(<Header />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
