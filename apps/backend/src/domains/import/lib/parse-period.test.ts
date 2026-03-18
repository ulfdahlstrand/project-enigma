import { describe, it, expect } from "vitest";
import { parsePeriod } from "./parse-period.js";

describe("parsePeriod", () => {
  // ---------------------------------------------------------------------------
  // Ongoing assignments
  // ---------------------------------------------------------------------------

  it("parses 'Q3 2025 – Pågående' as ongoing (Swedish en-dash)", () => {
    const result = parsePeriod("Q3 2025 – Pågående");
    expect(result).toEqual({
      startDate: new Date(Date.UTC(2025, 6, 1)),
      endDate: null,
      isCurrent: true,
    });
  });

  it("parses 'Q3 2025 – Ongoing' as ongoing (English)", () => {
    const result = parsePeriod("Q3 2025 – Ongoing");
    expect(result?.isCurrent).toBe(true);
    expect(result?.endDate).toBeNull();
  });

  it("parses 'Q1 2024 – Present' as ongoing", () => {
    const result = parsePeriod("Q1 2024 – Present");
    expect(result?.isCurrent).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Completed assignments (both ends)
  // ---------------------------------------------------------------------------

  it("parses 'Q4 2025 – Q1 2026' with en-dash", () => {
    const result = parsePeriod("Q4 2025 – Q1 2026");
    expect(result).toEqual({
      startDate: new Date(Date.UTC(2025, 9, 1)),
      endDate: new Date(Date.UTC(2026, 2, 31)),
      isCurrent: false,
    });
  });

  it("parses 'Q1 2023 - Q1 2024' with hyphen", () => {
    const result = parsePeriod("Q1 2023 - Q1 2024");
    expect(result).toEqual({
      startDate: new Date(Date.UTC(2023, 0, 1)),
      endDate: new Date(Date.UTC(2024, 2, 31)),
      isCurrent: false,
    });
  });

  it("parses 'Q3 2018 - Q2 2020'", () => {
    const result = parsePeriod("Q3 2018 - Q2 2020");
    expect(result).toEqual({
      startDate: new Date(Date.UTC(2018, 6, 1)),
      endDate: new Date(Date.UTC(2020, 5, 30)),
      isCurrent: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Start-only (no end token)
  // ---------------------------------------------------------------------------

  it("parses 'Q3 2025' as start-only, not current", () => {
    const result = parsePeriod("Q3 2025");
    expect(result).toEqual({
      startDate: new Date(Date.UTC(2025, 6, 1)),
      endDate: null,
      isCurrent: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Quarter boundary dates
  // ---------------------------------------------------------------------------

  it("Q1 start = Jan 1", () => {
    expect(parsePeriod("Q1 2020")?.startDate).toEqual(new Date(Date.UTC(2020, 0, 1)));
  });

  it("Q1 end = Mar 31", () => {
    expect(parsePeriod("Q1 2020 - Q1 2020")?.endDate).toEqual(new Date(Date.UTC(2020, 2, 31)));
  });

  it("Q2 start = Apr 1", () => {
    expect(parsePeriod("Q2 2020")?.startDate).toEqual(new Date(Date.UTC(2020, 3, 1)));
  });

  it("Q2 end = Jun 30", () => {
    expect(parsePeriod("Q2 2020 - Q2 2020")?.endDate).toEqual(new Date(Date.UTC(2020, 5, 30)));
  });

  it("Q3 start = Jul 1", () => {
    expect(parsePeriod("Q3 2020")?.startDate).toEqual(new Date(Date.UTC(2020, 6, 1)));
  });

  it("Q3 end = Sep 30", () => {
    expect(parsePeriod("Q3 2020 - Q3 2020")?.endDate).toEqual(new Date(Date.UTC(2020, 8, 30)));
  });

  it("Q4 start = Oct 1", () => {
    expect(parsePeriod("Q4 2020")?.startDate).toEqual(new Date(Date.UTC(2020, 9, 1)));
  });

  it("Q4 end = Dec 31", () => {
    expect(parsePeriod("Q4 2020 - Q4 2020")?.endDate).toEqual(new Date(Date.UTC(2020, 11, 31)));
  });

  // ---------------------------------------------------------------------------
  // Empty / unparseable inputs
  // ---------------------------------------------------------------------------

  it("returns null for empty string", () => {
    expect(parsePeriod("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parsePeriod("   ")).toBeNull();
  });

  it("returns null for unrecognised format", () => {
    expect(parsePeriod("Jan 2025 - Dec 2025")).toBeNull();
  });

  it("returns null for plain year range", () => {
    expect(parsePeriod("2020 - 2022")).toBeNull();
  });
});
