import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { persistRevisionToolCallSuggestions } from "./revision-suggestions.js";
import { readTreeContent } from "../../resume/lib/read-tree-content.js";

vi.mock("../../resume/lib/read-tree-content.js");

type MockTableConfig = {
  currentSuggestions?: unknown[];
  workItems?: unknown[];
  branch?: { head_commit_id: string | null; forked_from_commit_id: string | null } | null;
  commitContent?: unknown | null;
  branchAssignments?: Array<{ assignment_id: string; description: string }>;
};

function createMockChain(executeResult: unknown[], takefirstResult: unknown) {
  const chain: Record<string, unknown> = {};
  const fn = () => chain;
  chain["select"] = fn;
  chain["selectAll"] = fn;
  chain["where"] = fn;
  chain["orderBy"] = fn;
  chain["execute"] = vi.fn().mockResolvedValue(executeResult);
  chain["executeTakeFirst"] = vi.fn().mockResolvedValue(takefirstResult);
  return chain;
}

function buildDb(config: MockTableConfig = {}) {
  const {
    currentSuggestions = [],
    workItems = [
      {
        work_item_id: "work-item-1",
        section: "presentation",
        assignment_id: null,
        status: "pending",
      },
    ],
    branch = null,
    commitContent = null,
    branchAssignments = [],
  } = config;

  const insertedRows: unknown[][] = [];

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "ai_revision_suggestions") {
      return createMockChain(currentSuggestions as unknown[], undefined);
    }

    if (table === "ai_revision_work_items") {
      return createMockChain(workItems as unknown[], undefined);
    }

    if (table === "resume_branches") {
      return createMockChain([], branch);
    }

    if (table === "resume_commits") {
      const commitRow = commitContent !== null ? { tree_id: "tree-id-1" } : undefined;
      return createMockChain([], commitRow);
    }

    if (table === "branch_assignments") {
      return createMockChain(branchAssignments, undefined);
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const deleteFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  });

  const insertInto = vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((rows: unknown[]) => {
      insertedRows.push(rows);
      return {
        execute: vi.fn().mockResolvedValue(undefined),
      };
    }),
  });

  if (commitContent !== null) {
    vi.mocked(readTreeContent).mockResolvedValue(commitContent as Awaited<ReturnType<typeof readTreeContent>>);
  }

  return {
    db: { selectFrom, deleteFrom, insertInto } as unknown as Kysely<Database>,
    insertedRows,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("persistRevisionToolCallSuggestions", () => {
  it("links section suggestions to the matching persisted work item", async () => {
    const { db, insertedRows } = buildDb();

    const result = await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Fix presentation",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Fix presentation",
            description: "Correct the typo.",
            section: "presentation",
            suggestedText: "Updated presentation",
            status: "pending",
          },
        ],
      },
    });

    expect(result.saved).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.[0]).toMatchObject({
      work_item_id: "work-item-1",
      suggestion_id: "work-item-1:suggestion-1",
      section: "presentation",
      suggested_text: "Updated presentation",
    });
  });

  it("skips suggestions whose suggestedText is identical to the original section text", async () => {
    const originalText = "This is the original presentation text.";

    const { db, insertedRows } = buildDb({
      branch: { head_commit_id: "commit-1", forked_from_commit_id: null },
      commitContent: {
        title: "Senior Developer",
        consultantTitle: null,
        presentation: [originalText],
        summary: null,
        skills: [],
        assignments: [],
        highlightedItems: [],
        language: "en",
      },
    });

    const result = await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Review presentation",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Update presentation",
            description: "Rewrite the presentation.",
            section: "presentation",
            suggestedText: originalText,
          },
        ],
      },
    });

    expect(result.saved).toBe(true);
    expect(result.incomingCount).toBe(0);
    expect(insertedRows).toHaveLength(0);
  });

  it("skips suggestions whose suggestedText matches original after trimming", async () => {
    const originalText = "  Some text with surrounding whitespace  ";

    const { db, insertedRows } = buildDb({
      branch: { head_commit_id: "commit-1", forked_from_commit_id: null },
      commitContent: {
        title: "Developer",
        consultantTitle: null,
        presentation: [originalText],
        summary: null,
        skills: [],
        assignments: [],
        highlightedItems: [],
        language: "en",
      },
    });

    await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Review",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Trim and match",
            description: "Identical after trim.",
            section: "presentation",
            suggestedText: originalText.trim(),
          },
        ],
      },
    });

    expect(insertedRows).toHaveLength(0);
  });

  it("keeps suggestions whose suggestedText differs from the original", async () => {
    const { db, insertedRows } = buildDb({
      branch: { head_commit_id: "commit-1", forked_from_commit_id: null },
      commitContent: {
        title: "Developer",
        consultantTitle: null,
        presentation: ["Original text."],
        summary: null,
        skills: [],
        assignments: [],
        highlightedItems: [],
        language: "en",
      },
    });

    await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Review",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Improve presentation",
            description: "Make it better.",
            section: "presentation",
            suggestedText: "Improved text.",
          },
        ],
      },
    });

    expect(insertedRows).toHaveLength(1);
  });

  it("skips assignment suggestions identical to the original assignment description", async () => {
    const originalDescription = "Led a team of developers building microservices.";

    const { db, insertedRows } = buildDb({
      branch: { head_commit_id: null, forked_from_commit_id: null },
      branchAssignments: [
        { assignment_id: "assignment-abc", description: originalDescription },
      ],
      workItems: [
        {
          work_item_id: "work-item-1",
          section: "assignment",
          assignment_id: "assignment-abc",
          status: "pending",
        },
      ],
    });

    const result = await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Review assignments",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Update assignment",
            description: "Rewrite assignment.",
            section: "assignment",
            assignmentId: "assignment-abc",
            suggestedText: originalDescription,
          },
        ],
      },
    });

    expect(result.incomingCount).toBe(0);
    expect(insertedRows).toHaveLength(0);
  });

  it("saves suggestions when no branch content is available", async () => {
    const { db, insertedRows } = buildDb({
      branch: null,
    });

    await persistRevisionToolCallSuggestions(db, {
      conversationId: "conversation-1",
      branchId: "branch-1",
      toolName: "set_revision_suggestions",
      toolCallInput: {
        summary: "Review",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Fix presentation",
            description: "Some fix.",
            section: "presentation",
            suggestedText: "Any text",
          },
        ],
      },
    });

    expect(insertedRows).toHaveLength(1);
  });
});
