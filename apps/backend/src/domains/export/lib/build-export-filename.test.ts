import { describe, expect, it, vi } from "vitest";
import { buildExportFilename, formatExportTimestamp } from "./build-export-filename.js";

describe("formatExportTimestamp", () => {
  it("formats timestamps as YYYYMMDDHHMMSS", () => {
    expect(formatExportTimestamp(new Date("2026-04-07T15:45:09Z"))).toBe("20260407174509");
  });
});

describe("buildExportFilename", () => {
  it("builds the agreed export filename format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T15:45:09Z"));

    expect(
      buildExportFilename({
        consultantName: "Ulf Dahlstrand",
        company: "SthlmTech",
        language: "sv",
        branchName: "default",
        extension: "pdf",
      }),
    ).toBe("20260407174509 - Ulf Dahlstrand, SthlmTech - SV - default.pdf");

    vi.useRealTimers();
  });

  it("sanitizes invalid filename characters but preserves readability", () => {
    expect(
      buildExportFilename({
        exportedAt: new Date("2026-04-07T15:45:09Z"),
        consultantName: "Ulf / Dahlstrand",
        company: "Sthlm:Tech",
        language: "sv",
        branchName: "feature/test",
        extension: "docx",
      }),
    ).toBe("20260407174509 - Ulf - Dahlstrand, Sthlm-Tech - SV - feature-test.docx");
  });
});
