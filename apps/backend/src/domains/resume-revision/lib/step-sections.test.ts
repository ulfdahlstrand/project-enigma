import { describe, it, expect } from "vitest";
import { STEP_SECTIONS, getNextSection, isDiscoverySection } from "./step-sections.js";

describe("STEP_SECTIONS", () => {
  it("has exactly 7 entries", () => {
    expect(STEP_SECTIONS).toHaveLength(7);
  });

  it("starts with discovery and ends with consistency_polish", () => {
    expect(STEP_SECTIONS[0]).toBe("discovery");
    expect(STEP_SECTIONS[STEP_SECTIONS.length - 1]).toBe("consistency_polish");
  });

  it("contains all sections in the correct order", () => {
    expect(STEP_SECTIONS).toEqual([
      "discovery",
      "consultant_title",
      "presentation_summary",
      "skills",
      "assignments",
      "highlighted_experience",
      "consistency_polish",
    ]);
  });
});

describe("getNextSection", () => {
  it("returns consultant_title after discovery", () => {
    expect(getNextSection("discovery")).toBe("consultant_title");
  });

  it("returns null after consistency_polish (last section)", () => {
    expect(getNextSection("consistency_polish")).toBe(null);
  });

  it("returns assignments after skills", () => {
    expect(getNextSection("skills")).toBe("assignments");
  });

  it("returns highlighted_experience after assignments", () => {
    expect(getNextSection("assignments")).toBe("highlighted_experience");
  });

  it("returns presentation_summary after consultant_title", () => {
    expect(getNextSection("consultant_title")).toBe("presentation_summary");
  });
});

describe("isDiscoverySection", () => {
  it("returns true for discovery", () => {
    expect(isDiscoverySection("discovery")).toBe(true);
  });

  it("returns false for skills", () => {
    expect(isDiscoverySection("skills")).toBe(false);
  });

  it("returns false for all non-discovery sections", () => {
    const nonDiscovery = STEP_SECTIONS.filter((s) => s !== "discovery");
    for (const section of nonDiscovery) {
      expect(isDiscoverySection(section)).toBe(false);
    }
  });
});
