import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { executeBackendInspectTool, BACKEND_INSPECT_TOOLS } from "./tool-execution.js";
import type { ToolCallPayload } from "./tool-parsing.js";
import { readTreeContent } from "../../resume/lib/read-tree-content.js";

vi.mock("../../resume/lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const BRANCH_ID = "10000000-0000-4000-8000-000000000001";
const RESUME_ID = "20000000-0000-4000-8000-000000000001";
const COMMIT_ID = "30000000-0000-4000-8000-000000000001";
const ASSIGNMENT_ID = "40000000-0000-4000-8000-000000000001";

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

const BRANCH_ROW = {
  branchId: BRANCH_ID,
  head_commit_id: COMMIT_ID,
  resumeId: RESUME_ID,
  employeeName: "Ada Lovelace",
};

const COMMIT_CONTENT = {
  title: "Senior Engineer",
  consultantTitle: "Principal Engineer",
  language: "en",
  presentation: ["Expert in distributed systems.", "10 years experience."],
  summary: "A highly experienced engineer.",
  skills: [
    { name: "TypeScript", category: "Languages", sortOrder: 1 },
    { name: "Go", category: "Languages", sortOrder: 2 },
    { name: "Kubernetes", category: "Infrastructure", sortOrder: 3 },
  ],
  assignments: [
    {
      assignmentId: ASSIGNMENT_ID,
      clientName: "Acme Corp",
      role: "Lead Engineer",
      description: "Led the migration to microservices.",
      technologies: ["TypeScript", "Docker"],
      isCurrent: false,
      startDate: "2023-01-01",
      endDate: "2024-01-01",
      keywords: null,
      type: null,
      highlight: false,
      sortOrder: 0,
    },
  ],
};

/**
 * Build a minimal Kysely mock that returns the given branch data.
 *
 * The DB is queried in two sequential chains inside buildResumeSnapshotFromBranch:
 *   1. resume_branches → inner joins → executeTakeFirst()
 *   2. resume_commits   → executeTakeFirst()
 */
function buildDb({
  branchRow = BRANCH_ROW as unknown,
  commitContent = COMMIT_CONTENT,
  revisionWorkItems = [] as unknown[],
}: {
  branchRow?: unknown;
  commitContent?: typeof COMMIT_CONTENT | null;
  revisionWorkItems?: unknown[];
} = {}) {
  const revisionWorkItemsExecute = vi.fn().mockResolvedValue(revisionWorkItems);
  const revisionWorkItemsQuery = {
    selectAll: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ execute: revisionWorkItemsExecute }),
      }),
    }),
  };

  // Query 2: resume_commits
  const commitExecuteTakeFirst = vi
    .fn()
    .mockResolvedValue(commitContent !== null ? { tree_id: "tree-id-1" } : undefined);
  const commitQuery = {
    select: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst }),
    }),
  };

  // Query 1: resume_branches
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(branchRow);
  const branchQuery = {
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst }),
    }),
  };

  if (commitContent !== null) {
    vi.mocked(readTreeContent).mockResolvedValue(commitContent as Awaited<ReturnType<typeof readTreeContent>>);
  }

  let callIndex = 0;
  const selectFrom = vi.fn().mockImplementation(() => {
    const i = callIndex++;
    if (i === 0) return branchQuery;
    if (i === 1) return commitQuery;
    return revisionWorkItemsQuery;
  });

  return { selectFrom } as unknown as Kysely<Database>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function toolCall(toolName: string, input: Record<string, unknown> = {}): ToolCallPayload {
  return { type: "tool_call", toolName, input };
}

// ---------------------------------------------------------------------------
// BACKEND_INSPECT_TOOLS
// ---------------------------------------------------------------------------

describe("BACKEND_INSPECT_TOOLS", () => {
  it("contains the 6 expected tool names", () => {
    expect([...BACKEND_INSPECT_TOOLS]).toEqual([
      "inspect_resume",
      "inspect_resume_sections",
      "inspect_resume_section",
      "inspect_resume_skills",
      "list_revision_work_items",
      "list_resume_assignments",
      "inspect_assignment",
    ]);
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — entity type guard
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — entity type guard", () => {
  it("returns error for unsupported entity types", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "assignment",
      BRANCH_ID,
      toolCall("inspect_resume"),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("assignment");
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — branch not found
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — branch not found", () => {
  it("returns error when branch does not exist", async () => {
    const db = buildDb({ branchRow: null });
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      "non-existent-branch-id",
      toolCall("inspect_resume"),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Branch not found");
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — inspect_resume
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — inspect_resume", () => {
  it("returns resume overview with employee name, title, and skill groups", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume", { includeAssignments: true }),
    );

    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.resumeId).toBe(RESUME_ID);
    expect(output.employeeName).toBe("Ada Lovelace");
    expect(output.title).toBe("Senior Engineer");
    expect(output.consultantTitle).toBe("Principal Engineer");
    expect(output.language).toBe("en");
    expect(Array.isArray(output.skillGroups)).toBe(true);
    expect(output.assignmentCount).toBe(1);
    expect(Array.isArray(output.assignments)).toBe(true);
  });

  it("omits assignments when includeAssignments is false", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume", { includeAssignments: false }),
    );

    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.assignments).toEqual([]);
  });

  it("defaults to includeAssignments=true when input is empty", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume"),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(Array.isArray(output.assignments)).toBe(true);
  });

  it("handles missing commit content gracefully", async () => {
    const db = buildDb({ commitContent: null });
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume"),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.title).toBe("");
    expect(output.skillGroups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — inspect_resume_sections
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — inspect_resume_sections", () => {
  it("returns title, presentation, summary, and assignments", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_sections", { includeAssignments: true }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.title).toBe("Senior Engineer");
    expect(typeof output.presentation).toBe("string");
    expect(output.summary).toBe("A highly experienced engineer.");
    const assignments = output.assignments as unknown[];
    expect(assignments.length).toBe(1);
  });

  it("omits assignments when includeAssignments is false", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_sections", { includeAssignments: false }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.assignments).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — inspect_resume_section
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — inspect_resume_section", () => {
  it("returns title section text", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_section", { section: "title" }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.section).toBe("title");
    expect(output.text).toBe("Senior Engineer");
  });

  it("returns presentation section", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_section", { section: "presentation" }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.section).toBe("presentation");
    expect(typeof output.text).toBe("string");
    expect(Array.isArray(output.paragraphs)).toBe(true);
  });

  it("returns summary section", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_section", { section: "summary" }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.text).toBe("A highly experienced engineer.");
  });

  it("returns assignment section by ID", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_section", { section: "assignment", assignmentId: ASSIGNMENT_ID }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.assignmentId).toBe(ASSIGNMENT_ID);
    expect(output.clientName).toBe("Acme Corp");
  });

  it("returns error when assignment ID not found", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_section", { section: "assignment", assignmentId: "unknown-id" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Assignment not found");
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — inspect_resume_skills
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — inspect_resume_skills", () => {
  it("returns skill groups ordered by sortOrder", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_resume_skills"),
    );
    expect(result.ok).toBe(true);
    const output = result.output as { totalSkills: number; groups: unknown[] };
    expect(output.totalSkills).toBe(3);
    expect(output.groups.length).toBe(2); // Languages + Infrastructure
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — list_resume_assignments
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — list_resume_assignments", () => {
  it("returns assignment list with index, id, clientName, role", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("list_resume_assignments"),
    );
    expect(result.ok).toBe(true);
    const output = result.output as { totalAssignments: number; assignments: unknown[] };
    expect(output.totalAssignments).toBe(1);
    const first = output.assignments[0] as Record<string, unknown>;
    expect(first.index).toBe(0);
    expect(first.assignmentId).toBe(ASSIGNMENT_ID);
    expect(first.clientName).toBe("Acme Corp");
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — list_revision_work_items
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — list_revision_work_items", () => {
  it("returns persisted work items with remaining count", async () => {
    const db = buildDb({
      revisionWorkItems: [
        {
          work_item_id: "work-item-1",
          title: "Review presentation",
          description: "Check presentation text.",
          section: "presentation",
          assignment_id: null,
          status: "completed",
          note: null,
          attempt_count: 1,
          last_error: null,
          position: 0,
          completed_at: new Date("2026-04-04T08:00:00.000Z"),
          updated_at: new Date("2026-04-04T08:00:00.000Z"),
        },
        {
          work_item_id: "work-item-2",
          title: "Review assignments",
          description: "Check assignment text.",
          section: "assignment",
          assignment_id: null,
          status: "pending",
          note: null,
          attempt_count: 0,
          last_error: null,
          position: 1,
          completed_at: null,
          updated_at: new Date("2026-04-04T08:05:00.000Z"),
        },
      ],
    });

    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("list_revision_work_items"),
      { conversationId: "conversation-1" },
    );

    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.totalWorkItems).toBe(2);
    expect(output.remainingWorkItems).toBe(1);
    expect(Array.isArray(output.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — inspect_assignment
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — inspect_assignment", () => {
  it("returns full assignment details", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_assignment", { assignmentId: ASSIGNMENT_ID }),
    );
    expect(result.ok).toBe(true);
    const output = result.output as Record<string, unknown>;
    expect(output.assignmentId).toBe(ASSIGNMENT_ID);
    expect(output.clientName).toBe("Acme Corp");
    expect(output.role).toBe("Lead Engineer");
    expect(typeof output.text).toBe("string");
  });

  it("returns error when assignment not found", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("inspect_assignment", { assignmentId: "unknown-id" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Assignment not found");
  });
});

// ---------------------------------------------------------------------------
// executeBackendInspectTool — unknown tool
// ---------------------------------------------------------------------------

describe("executeBackendInspectTool — unknown tool", () => {
  it("returns error for unknown tool names", async () => {
    const db = buildDb();
    const result = await executeBackendInspectTool(
      db,
      "resume-revision-actions",
      BRANCH_ID,
      toolCall("set_revision_work_items"),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown inspect tool");
  });
});
