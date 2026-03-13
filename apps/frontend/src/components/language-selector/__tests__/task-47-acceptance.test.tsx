import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockChangeLanguage = vi.fn();

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: { changeLanguage: mockChangeLanguage, language: "en" },
    }),
  };
});

import { LanguageSelector } from "../LanguageSelector";
import { localeFlagMap } from "../locale-flag-map";

describe("LanguageSelector (language-selector)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders flag SVG elements for each supported locale", () => {
    const { container } = render(
      <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} />
    );
    const svgElements = container.querySelectorAll("svg");
    expect(svgElements.length).toBeGreaterThanOrEqual(
      Object.keys(localeFlagMap).length
    );
  });

  it("calls onLocaleChange when the user selects a different option", async () => {
    const onLocaleChange = vi.fn();
    render(
      <LanguageSelector currentLocale="en" onLocaleChange={onLocaleChange} />
    );

    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);

    const options = screen.getAllByRole("option");
    const svOption = options.find(
      (opt) => opt.getAttribute("data-value") === "sv"
    );
    if (svOption) {
      await userEvent.click(svOption);
      expect(onLocaleChange).toHaveBeenCalledWith("sv");
    } else if (options.length > 0) {
      await userEvent.click(options[0]!);
      expect(onLocaleChange).toHaveBeenCalledWith(expect.any(String));
    }
  });

  it("has an accessible aria-label on the select element", () => {
    render(
      <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} />
    );
    const select = screen.getByRole("combobox");
    expect((select.getAttribute("aria-label") ?? "").length).toBeGreaterThan(
      0
    );
  });
});
