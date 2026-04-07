import { describe, expect, it } from "vitest";
import { getNextSkillSortOrder, reorderSkillsByIds, reorderSkillsInGroup } from "../useSkillsEditor";

const sortedCategories = [
  {
    id: "group-dev",
    category: "Dev",
    sortOrder: 0,
    skills: [
      { id: "1", groupId: "group-dev", name: "TypeScript", category: "Dev", sortOrder: 0 },
      { id: "2", groupId: "group-dev", name: "React", category: "Dev", sortOrder: 1 },
    ],
  },
  {
    id: "group-test",
    category: "Test",
    sortOrder: 1,
    skills: [
      { id: "3", groupId: "group-test", name: "Playwright", category: "Test", sortOrder: 1000 },
      { id: "4", groupId: "group-test", name: "Vitest", category: "Test", sortOrder: 1001 },
    ],
  },
  {
    id: "group-management",
    category: "Management",
    sortOrder: 2,
    skills: [
      { id: "5", groupId: "group-management", name: "Coaching", category: "Management", sortOrder: 2000 },
      { id: "6", groupId: "group-management", name: "Planning", category: "Management", sortOrder: 2001 },
    ],
  },
] as const;

describe("getNextSkillSortOrder", () => {
  it("appends inside an existing category without changing that category's position", () => {
    expect(getNextSkillSortOrder(sortedCategories as any, "group-management")).toBe(2002);
    expect(getNextSkillSortOrder(sortedCategories as any, "group-test")).toBe(1002);
  });

  it("places a brand-new category after the existing ordered categories", () => {
    expect(getNextSkillSortOrder(sortedCategories as any, "group-architecture")).toBe(2002);
  });
});

describe("reorderSkillsInGroup", () => {
  it("moves a skill up within its group without affecting other groups", () => {
    const reordered = reorderSkillsInGroup(sortedCategories as any, "group-test", "4", "up");

    expect(reordered.map((skill) => ({ id: skill.id, sortOrder: skill.sortOrder }))).toEqual([
      { id: "4", sortOrder: 0 },
      { id: "3", sortOrder: 1 },
    ]);
  });

  it("returns an empty array when the move is not possible", () => {
    expect(reorderSkillsInGroup(sortedCategories as any, "group-dev", "1", "up")).toEqual([]);
  });
});

describe("reorderSkillsByIds", () => {
  it("reorders skills within the given group based on explicit ids", () => {
    const reordered = reorderSkillsByIds(sortedCategories as any, "group-dev", ["2", "1"]);

    expect(reordered.map((skill) => ({ id: skill.id, sortOrder: skill.sortOrder }))).toEqual([
      { id: "2", sortOrder: 0 },
      { id: "1", sortOrder: 1 },
    ]);
  });
});
