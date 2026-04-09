import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { persistRevisionToolCallSuggestions } from "./revision-suggestions.js";
import { readBranchAssignmentContent } from "../../resume/lib/branch-assignment-content.js";

vi.mock("../../resume/lib/branch-assignment-content.js");

type MockTableConfig = {
  currentSuggestions?: unknown[];
  workItems?: unknown[];
  branchContent?: unknown | null;
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
    branchContent = null,
  } = config;

  const insertedRows: unknown[][] = [];

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "ai_revision_suggestions") {
      return createMockChain(currentSuggestions as unknown[], undefined);
    }

    if (table === "ai_revision_work_items") {
      return createMockChain(workItems as unknown[], undefined);
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

  vi.mocked(readBranchAssignmentContent).mockResolvedValue(
    branchContent === null
      ? null
      : {
          branchId: "branch-1",
          resumeId: "resume-1",
          employeeId: "employee-1",
          title: "Resume",
          language: "en",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          content: branchContent as NonNullable<Awaited<ReturnType<typeof readBranchAssignmentContent>>>["content"],
        },
  );

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
      branchContent: {
        title: "Senior Developer",
        consultantTitle: null,
        presentation: [originalText],
        summary: null,
        education: [],
        skillGroups: [],
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
      branchContent: {
        title: "Developer",
        consultantTitle: null,
        presentation: [originalText],
        summary: null,
        education: [],
        skillGroups: [],
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
      branchContent: {
        title: "Developer",
        consultantTitle: null,
        presentation: ["Original text."],
        summary: null,
        education: [],
        skillGroups: [],
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
      branchContent: {
        title: "Developer",
        consultantTitle: null,
        presentation: [],
        summary: null,
        education: [],
        skillGroups: [],
        skills: [],
        highlightedItems: [],
        language: "en",
        assignments: [{
          assignmentId: "assignment-abc",
          clientName: "Acme",
          role: "Lead",
          description: originalDescription,
          startDate: "2024-01-01",
          endDate: null,
          technologies: [],
          isCurrent: true,
          keywords: null,
          type: null,
          highlight: false,
          sortOrder: null,
        }],
      },
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
      branchContent: null,
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
