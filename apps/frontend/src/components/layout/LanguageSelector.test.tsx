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
// mockLanguage is mutable so individual tests can set the starting locale.
// ---------------------------------------------------------------------------
const mockChangeLanguage = vi.fn();
let mockLanguage = "en";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: {
        changeLanguage: mockChangeLanguage,
        language: mockLanguage,
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
    vi.clearAllMocks();
    mockLanguage = "en";
  });

  it("renders a MenuItem for each supported language (en and sv)", async () => {
    render(<LanguageSelector />);

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
    render(<LanguageSelector />);

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

    expect(mockChangeLanguage).toHaveBeenCalledWith("sv");
  });

  it("calls i18n.changeLanguage('en') when the English option is selected", async () => {
    mockLanguage = "sv";
    render(<LanguageSelector />);

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

    expect(mockChangeLanguage).toHaveBeenCalledWith("en");
  });
});
