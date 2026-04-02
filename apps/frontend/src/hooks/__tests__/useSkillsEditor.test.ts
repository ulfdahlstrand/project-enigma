import { describe, expect, it } from "vitest";
import type { SkillRow } from "../../components/SkillsEditor";
import { getNextSkillSortOrder } from "../useSkillsEditor";

const sortedCategories: [string, SkillRow[]][] = [
  [
    "Dev",
    [
      { id: "1", name: "TypeScript", level: null, category: "Dev", sortOrder: 0 },
      { id: "2", name: "React", level: null, category: "Dev", sortOrder: 1 },
    ],
  ],
  [
    "Test",
    [
      { id: "3", name: "Playwright", level: null, category: "Test", sortOrder: 1000 },
      { id: "4", name: "Vitest", level: null, category: "Test", sortOrder: 1001 },
    ],
  ],
  [
    "Management",
    [
      { id: "5", name: "Coaching", level: null, category: "Management", sortOrder: 2000 },
      { id: "6", name: "Planning", level: null, category: "Management", sortOrder: 2001 },
    ],
  ],
];

describe("getNextSkillSortOrder", () => {
  it("appends inside an existing category without changing that category's position", () => {
    expect(getNextSkillSortOrder(sortedCategories, "Management")).toBe(2002);
    expect(getNextSkillSortOrder(sortedCategories, "Test")).toBe(1002);
  });

  it("places a brand-new category after the existing ordered categories", () => {
    expect(getNextSkillSortOrder(sortedCategories, "Architecture")).toBe(3000);
  });
});
