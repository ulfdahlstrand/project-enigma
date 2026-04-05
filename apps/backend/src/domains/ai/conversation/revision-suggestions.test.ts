import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { persistRevisionToolCallSuggestions } from "./revision-suggestions.js";

function buildDb() {
  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "ai_revision_suggestions") {
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
    }

    if (table === "ai_revision_work_items") {
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                {
                  work_item_id: "work-item-1",
                  section: "presentation",
                  assignment_id: null,
                  status: "pending",
                },
              ]),
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const insertedRows: unknown[][] = [];

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

  return {
    db: { selectFrom, deleteFrom, insertInto } as unknown as Kysely<Database>,
    insertedRows,
  };
}

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
});
