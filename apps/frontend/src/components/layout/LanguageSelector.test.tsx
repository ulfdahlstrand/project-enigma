/**
 * Unit tests for the layout LanguageSelector component.
 *
 * Covers the two requirements from Task #78 AC9:
 *   1. The dropdown renders a MenuItem for each supported language.
 *   2. Selecting a language option triggers i18n.changeLanguage with the
 *      correct locale string.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-i18next so tests are isolated from locale file loading.
// ---------------------------------------------------------------------------
const changeLanguageMock = vi.fn();
const languageHolder = { current: "en" };

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: {
        changeLanguage: changeLanguageMock,
        // Use a getter so tests can mutate languageHolder.current
        get language() {
          return languageHolder.current;
        },
      },
    }),
  };
});

// ---------------------------------------------------------------------------
// Import component AFTER the mock is in place
// ---------------------------------------------------------------------------
import { LanguageSelector } from "./LanguageSelector";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LanguageSelector (layout)", () => {
  beforeEach(() => {
    changeLanguageMock.mockClear();
    languageHolder.current = "en";
  });

  it("renders a MenuItem for each supported language (en and sv)", async () => {
    render(React.createElement(LanguageSelector));

    // MUI Select renders a combobox; click it to open the dropdown
    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);

    // After opening, MUI renders a listbox with one option per MenuItem
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    // Exactly two languages: English and Swedish
    expect(options).toHaveLength(2);
  });

  it("calls i18n.changeLanguage('sv') when the Swedish option is selected", async () => {
    render(React.createElement(LanguageSelector));

    // Open the dropdown
    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);

    // Find and click the 'sv' option
    const listbox = screen.getByRole("listbox");
    const svOption = within(listbox)
      .getAllByRole("option")
      .find((opt) => opt.getAttribute("data-value") === "sv");

    expect(svOption).toBeDefined();
    await userEvent.click(svOption!);

    expect(changeLanguageMock).toHaveBeenCalledWith("sv");
  });

  it("calls i18n.changeLanguage('en') when the English option is selected", async () => {
    // Start on Swedish so English is a genuine new selection
    languageHolder.current = "sv";

    render(React.createElement(LanguageSelector));

    // Open the dropdown
    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);

    // Find and click the 'en' option
    const listbox = screen.getByRole("listbox");
    const enOption = within(listbox)
      .getAllByRole("option")
      .find((opt) => opt.getAttribute("data-value") === "en");

    expect(enOption).toBeDefined();
    await userEvent.click(enOption!);

    expect(changeLanguageMock).toHaveBeenCalledWith("en");
  });
});
