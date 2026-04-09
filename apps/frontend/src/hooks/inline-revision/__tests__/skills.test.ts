import { describe, expect, it } from "vitest";
import { buildSkillsReviewValue, hydrateSkillsSuggestion } from "../skills";

const currentSkills = [
  { name: "TypeScript", category: "Backend", sortOrder: 0 },
  { name: "Node.js", category: "Backend", sortOrder: 1 },
  { name: "React", category: "Frontend", sortOrder: 1000 },
] as const;

describe("hydrateSkillsSuggestion", () => {
  it("detects a skill group rename from the suggested text", () => {
    const hydrated = hydrateSkillsSuggestion(
      {
        id: "s1",
        title: "Translate skill group",
        description: "Translate Backend to Swedish",
        section: "skills",
        suggestedText: "Backendutveckling: TypeScript, Node.js",
        status: "pending",
      },
      [...currentSkills],
    );

    expect(hydrated.skillScope).toEqual({
      type: "group_rename",
      category: "Backend",
    });
    expect(hydrated.skills?.filter((skill) => skill.category === "Backendutveckling")).toHaveLength(2);
  });
});

describe("buildSkillsReviewValue", () => {
  it("renders a rename review as heading-only before/after sections", () => {
    const reviewValue = buildSkillsReviewValue(currentSkills as any, {
      id: "s1",
      title: "Translate skill group",
      description: "Translate Backend to Swedish",
      section: "skills",
      suggestedText: "Backendutveckling: TypeScript, Node.js",
      status: "pending",
      skills: [
        { name: "TypeScript", category: "Backendutveckling", sortOrder: 0 },
        { name: "Node.js", category: "Backendutveckling", sortOrder: 1 },
        { name: "React", category: "Frontend", sortOrder: 1000 },
      ],
      skillScope: {
        type: "group_rename",
        category: "Backend",
      },
    });

    expect(reviewValue).toEqual({
      suggestionId: "s1",
      mode: "group_rename",
      targetCategory: "Backend",
      originalSections: [{ heading: "Backend", items: [] }],
      suggestedSections: [{ heading: "Backendutveckling", items: [] }],
    });
  });
});
