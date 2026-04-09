import { describe, expect, it, vi } from "vitest";
import { applySuggestionToSkills } from "../apply";

describe("applySuggestionToSkills", () => {
  it("renames only the targeted skill group category", async () => {
    const saveVersion = vi.fn().mockResolvedValue({});

    const applied = await applySuggestionToSkills(
      {
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
      },
      {
        activeBranchId: "branch-1",
        skills: [
          { name: "TypeScript", category: "Backend", sortOrder: 0 },
          { name: "Node.js", category: "Backend", sortOrder: 1 },
          { name: "React", category: "Frontend", sortOrder: 1000 },
        ],
        saveVersion,
        buildCommitMessage: () => "Translate Backend skill group",
      },
    );

    expect(applied).toBe(true);
    expect(saveVersion).toHaveBeenCalledOnce();
    expect(saveVersion).toHaveBeenCalledWith({
      branchId: "branch-1",
      title: "Translate Backend skill group",
      skills: [
        { name: "TypeScript", category: "Backendutveckling", sortOrder: 0 },
        { name: "Node.js", category: "Backendutveckling", sortOrder: 1 },
        { name: "React", category: "Frontend", sortOrder: 1000 },
      ],
    });
  });
});
