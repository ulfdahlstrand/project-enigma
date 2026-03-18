import { describe, it, expect } from "vitest";
import { diffResumeCommits } from "./resume-diff.js";
import type { ResumeCommitContent } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_SKILL = {
  name: "TypeScript",
  level: "Expert",
  category: "Languages",
  sortOrder: 1,
};

const BASE_ASSIGNMENT = {
  assignmentId: "aaaaaaaa-0000-0000-0000-000000000001",
  clientName: "Acme Corp",
  role: "Engineer",
  description: "Built stuff",
  startDate: "2020-01-01",
  endDate: null,
  technologies: ["TypeScript", "React"],
  isCurrent: true,
  keywords: null,
  type: null,
  highlight: false,
  sortOrder: null,
};

const base: ResumeCommitContent = {
  title: "Senior Engineer",
  consultantTitle: null,
  presentation: ["I am a consultant"],
  summary: null,
  language: "en",
  skills: [BASE_SKILL],
  assignments: [BASE_ASSIGNMENT],
};

// ---------------------------------------------------------------------------
// No changes
// ---------------------------------------------------------------------------

describe("diffResumeCommits — no changes", () => {
  it("returns hasChanges=false when base and head are identical", () => {
    const result = diffResumeCommits(base, base);
    expect(result.hasChanges).toBe(false);
    expect(result.scalars).toEqual({});
    expect(result.skills.every((s) => s.status === "unchanged")).toBe(true);
    expect(result.assignments.every((a) => a.status === "unchanged")).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Scalar diffs
// ---------------------------------------------------------------------------

describe("diffResumeCommits — scalar changes", () => {
  it("detects title change", () => {
    const head: ResumeCommitContent = { ...base, title: "Lead Engineer" };
    const result = diffResumeCommits(base, head);
    expect(result.hasChanges).toBe(true);
    expect(result.scalars.title).toEqual({
      before: "Senior Engineer",
      after: "Lead Engineer",
    });
  });

  it("detects consultantTitle change from null to string", () => {
    const head: ResumeCommitContent = {
      ...base,
      consultantTitle: "Tech Lead",
    };
    const result = diffResumeCommits(base, head);
    expect(result.scalars.consultantTitle).toEqual({
      before: null,
      after: "Tech Lead",
    });
  });

  it("detects presentation array change", () => {
    const head: ResumeCommitContent = {
      ...base,
      presentation: ["I am a consultant", "Extra line"],
    };
    const result = diffResumeCommits(base, head);
    expect(result.scalars.presentation).toBeDefined();
    expect(result.scalars.presentation?.after).toHaveLength(2);
  });

  it("detects language change", () => {
    const head: ResumeCommitContent = { ...base, language: "sv" };
    const result = diffResumeCommits(base, head);
    expect(result.scalars.language).toEqual({ before: "en", after: "sv" });
  });

  it("does not include unchanged scalars in result", () => {
    const head: ResumeCommitContent = { ...base, title: "New Title" };
    const result = diffResumeCommits(base, head);
    expect(result.scalars.language).toBeUndefined();
    expect(result.scalars.summary).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Skill diffs
// ---------------------------------------------------------------------------

describe("diffResumeCommits — skill changes", () => {
  it("detects added skill", () => {
    const newSkill = {
      name: "Go",
      level: null,
      category: null,
      sortOrder: 2,
    };
    const head: ResumeCommitContent = {
      ...base,
      skills: [...base.skills, newSkill],
    };
    const result = diffResumeCommits(base, head);
    const go = result.skills.find((s) => s.name === "Go");
    expect(go?.status).toBe("added");
    expect(go?.after).toEqual(newSkill);
    expect(go?.before).toBeUndefined();
    expect(result.hasChanges).toBe(true);
  });

  it("detects removed skill", () => {
    const head: ResumeCommitContent = { ...base, skills: [] };
    const result = diffResumeCommits(base, head);
    const ts = result.skills.find((s) => s.name === "TypeScript");
    expect(ts?.status).toBe("removed");
    expect(ts?.before).toEqual(BASE_SKILL);
    expect(ts?.after).toBeUndefined();
  });

  it("detects modified skill (level change)", () => {
    const head: ResumeCommitContent = {
      ...base,
      skills: [{ ...BASE_SKILL, level: "Senior" }],
    };
    const result = diffResumeCommits(base, head);
    const ts = result.skills.find((s) => s.name === "TypeScript");
    expect(ts?.status).toBe("modified");
    expect(ts?.before?.level).toBe("Expert");
    expect(ts?.after?.level).toBe("Senior");
  });

  it("marks skill as unchanged when nothing changed", () => {
    const head: ResumeCommitContent = {
      ...base,
      skills: [{ ...BASE_SKILL }],
    };
    const result = diffResumeCommits(base, head);
    const ts = result.skills.find((s) => s.name === "TypeScript");
    expect(ts?.status).toBe("unchanged");
  });
});

// ---------------------------------------------------------------------------
// Assignment diffs
// ---------------------------------------------------------------------------

describe("diffResumeCommits — assignment changes", () => {
  it("detects added assignment", () => {
    const newAssignment = {
      ...BASE_ASSIGNMENT,
      assignmentId: "bbbbbbbb-0000-0000-0000-000000000002",
      clientName: "Beta Inc",
    };
    const head: ResumeCommitContent = {
      ...base,
      assignments: [...base.assignments, newAssignment],
    };
    const result = diffResumeCommits(base, head);
    const beta = result.assignments.find(
      (a) => a.assignmentId === newAssignment.assignmentId
    );
    expect(beta?.status).toBe("added");
    expect(beta?.after?.clientName).toBe("Beta Inc");
  });

  it("detects removed assignment", () => {
    const head: ResumeCommitContent = { ...base, assignments: [] };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("removed");
  });

  it("detects modified assignment (role change)", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [{ ...BASE_ASSIGNMENT, role: "Lead Engineer" }],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("modified");
    expect(acme?.before?.role).toBe("Engineer");
    expect(acme?.after?.role).toBe("Lead Engineer");
  });

  it("detects modified assignment when technologies array changes", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [
        { ...BASE_ASSIGNMENT, technologies: ["TypeScript", "React", "Node.js"] },
      ],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("modified");
  });

  it("does NOT report modified when technologies are reordered (order-insensitive)", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [
        { ...BASE_ASSIGNMENT, technologies: ["React", "TypeScript"] },
      ],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("unchanged");
  });

  it("detects modified assignment when keywords change", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [{ ...BASE_ASSIGNMENT, keywords: "consulting" }],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("modified");
  });

  it("detects modified assignment when highlight changes", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [{ ...BASE_ASSIGNMENT, highlight: true }],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("modified");
  });

  it("detects modified assignment when sortOrder changes", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [{ ...BASE_ASSIGNMENT, sortOrder: 5 }],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("modified");
  });

  it("marks assignment as unchanged when nothing changed", () => {
    const head: ResumeCommitContent = {
      ...base,
      assignments: [{ ...BASE_ASSIGNMENT }],
    };
    const result = diffResumeCommits(base, head);
    const acme = result.assignments.find(
      (a) => a.assignmentId === BASE_ASSIGNMENT.assignmentId
    );
    expect(acme?.status).toBe("unchanged");
    expect(result.hasChanges).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasChanges combinations
// ---------------------------------------------------------------------------

describe("diffResumeCommits — hasChanges", () => {
  it("is false when only unchanged skills/assignments exist", () => {
    const result = diffResumeCommits(base, { ...base });
    expect(result.hasChanges).toBe(false);
  });

  it("is true when any scalar changes", () => {
    const head: ResumeCommitContent = { ...base, language: "sv" };
    expect(diffResumeCommits(base, head).hasChanges).toBe(true);
  });

  it("handles empty base and head (both empty)", () => {
    const empty: ResumeCommitContent = {
      title: "t",
      consultantTitle: null,
      presentation: [],
      summary: null,
      language: "en",
      skills: [],
      assignments: [],
    };
    const result = diffResumeCommits(empty, empty);
    expect(result.hasChanges).toBe(false);
    expect(result.skills).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
  });
});
