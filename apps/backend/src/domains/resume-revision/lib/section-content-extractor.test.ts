import { describe, it, expect } from "vitest";
import { extractSectionContent, applySectionContent } from "./section-content-extractor.js";
import type { ResumeCommitContent } from "../../../db/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONTENT: ResumeCommitContent = {
  title: "Senior Developer",
  consultantTitle: "Tech Lead",
  presentation: ["Paragraph one", "Paragraph two"],
  summary: "Experienced backend engineer",
  language: "en",
  skills: [
    { name: "TypeScript", level: "expert", category: "languages", sortOrder: 0 },
    { name: "React", level: "intermediate", category: "frontend", sortOrder: 1 },
  ],
  assignments: [
    {
      assignmentId: "asgn-1",
      clientName: "Acme Corp",
      role: "Backend Engineer",
      description: "Built APIs",
      startDate: "2023-01-01",
      endDate: null,
      technologies: ["Node.js"],
      isCurrent: true,
      keywords: null,
      type: null,
      highlight: true,
      sortOrder: 0,
    },
    {
      assignmentId: "asgn-2",
      clientName: "Beta Inc",
      role: "Lead Developer",
      description: "Led team",
      startDate: "2022-01-01",
      endDate: "2022-12-31",
      technologies: ["Go"],
      isCurrent: false,
      keywords: null,
      type: null,
      highlight: false,
      sortOrder: 1,
    },
  ],
};

// ---------------------------------------------------------------------------
// extractSectionContent
// ---------------------------------------------------------------------------

describe("extractSectionContent", () => {
  it("returns { consultantTitle } for consultant_title section", () => {
    const result = extractSectionContent("consultant_title", BASE_CONTENT);
    expect(result).toEqual({ consultantTitle: "Tech Lead" });
  });

  it("returns { skills } for skills section", () => {
    const result = extractSectionContent("skills", BASE_CONTENT) as { skills: unknown[] };
    expect(result).toHaveProperty("skills");
    expect((result).skills).toHaveLength(2);
  });

  it("returns { assignments } with full assignment data for assignments section", () => {
    const result = extractSectionContent("assignments", BASE_CONTENT) as { assignments: unknown[] };
    expect(result).toHaveProperty("assignments");
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0]).toMatchObject({ assignmentId: "asgn-1", clientName: "Acme Corp" });
  });

  it("returns assignments with only id, clientName, role, startDate, endDate for highlighted_experience", () => {
    const result = extractSectionContent("highlighted_experience", BASE_CONTENT) as {
      assignments: Array<{ assignmentId: string; clientName: string; role: string; startDate: string; endDate: string | null }>;
    };
    expect(result.assignments).toHaveLength(2);
    const first = result.assignments[0];
    expect(Object.keys(first)).toEqual(
      expect.arrayContaining(["assignmentId", "clientName", "role", "startDate", "endDate"])
    );
    expect(first).not.toHaveProperty("description");
    expect(first).not.toHaveProperty("technologies");
    expect(first).not.toHaveProperty("highlight");
    expect(first.assignmentId).toBe("asgn-1");
    expect(first.startDate).toBe("2023-01-01");
  });

  it("returns null for discovery section", () => {
    expect(extractSectionContent("discovery", BASE_CONTENT)).toBeNull();
  });

  it("returns full content for consistency_polish section", () => {
    const result = extractSectionContent("consistency_polish", BASE_CONTENT);
    expect(result).toBe(BASE_CONTENT);
  });

  it("returns { presentation, summary } for presentation_summary section", () => {
    const result = extractSectionContent("presentation_summary", BASE_CONTENT);
    expect(result).toEqual({
      presentation: BASE_CONTENT.presentation,
      summary: BASE_CONTENT.summary,
    });
  });
});

// ---------------------------------------------------------------------------
// applySectionContent
// ---------------------------------------------------------------------------

describe("applySectionContent", () => {
  it("updates consultantTitle for consultant_title section", () => {
    const result = applySectionContent("consultant_title", BASE_CONTENT, { consultantTitle: "CTO" });
    expect(result.consultantTitle).toBe("CTO");
  });

  it("can set consultantTitle to null", () => {
    const result = applySectionContent("consultant_title", BASE_CONTENT, { consultantTitle: null });
    expect(result.consultantTitle).toBeNull();
  });

  it("preserves base skills when proposed skills array is empty", () => {
    const result = applySectionContent("skills", BASE_CONTENT, { skills: [] });
    expect(result.skills).toEqual(BASE_CONTENT.skills);
  });

  it("returns base content unchanged for highlighted_experience (writes go to resume_highlighted_items)", () => {
    const proposal = { items: ["bullet 1", "bullet 2"] };
    const result = applySectionContent("highlighted_experience", BASE_CONTENT, proposal);
    expect(result).toEqual(BASE_CONTENT);
  });

  it("preserves all assignments unchanged when applying highlighted_experience", () => {
    const proposal = { items: ["bullet 1"] };
    const result = applySectionContent("highlighted_experience", BASE_CONTENT, proposal);
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0].clientName).toBe("Acme Corp");
    expect(result.assignments[1].clientName).toBe("Beta Inc");
  });

  it("returns base unchanged for discovery section", () => {
    const result = applySectionContent("discovery", BASE_CONTENT, { anything: "ignored" });
    expect(result).toEqual(BASE_CONTENT);
  });

  it("never mutates the input base content — immutability check", () => {
    const frozen = Object.freeze({ ...BASE_CONTENT, assignments: BASE_CONTENT.assignments.map((a) => ({ ...a })) });
    expect(() =>
      applySectionContent("consultant_title", frozen as ResumeCommitContent, { consultantTitle: "CTO" })
    ).not.toThrow();
    expect(frozen.consultantTitle).toBe("Tech Lead");
  });

  it("never mutates the input assignments array for highlighted_experience", () => {
    const originalHighlight = BASE_CONTENT.assignments[0].highlight;
    applySectionContent("highlighted_experience", BASE_CONTENT, {
      assignments: [{ assignmentId: "asgn-1", highlight: !originalHighlight }],
    });
    expect(BASE_CONTENT.assignments[0].highlight).toBe(originalHighlight);
  });
});
