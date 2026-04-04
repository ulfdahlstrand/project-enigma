import { describe, expect, it } from "vitest";
import { applyRevisionToolCallToWorkItems } from "./revision-work-items.js";

describe("applyRevisionToolCallToWorkItems", () => {
  it("replaces the current work-item state from set_revision_work_items", () => {
    const next = applyRevisionToolCallToWorkItems([], {
      toolName: "set_revision_work_items",
      input: {
        summary: "Review",
        items: [
          {
            id: "work-item-1",
            title: "Review presentation",
            description: "Check the presentation text.",
            section: "presentation",
            status: "pending",
          },
        ],
      },
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      work_item_id: "work-item-1",
      title: "Review presentation",
      section: "presentation",
      status: "pending",
    });
  });

  it("marks a work item completed from assignment suggestions", () => {
    const current = applyRevisionToolCallToWorkItems([], {
      toolName: "set_revision_work_items",
      input: {
        summary: "Review",
        items: [
          {
            id: "work-item-1",
            title: "Review assignment",
            description: "Check assignment text.",
            section: "assignment",
            assignmentId: "assignment-1",
            status: "pending",
          },
        ],
      },
    });

    const next = applyRevisionToolCallToWorkItems(current, {
      toolName: "set_assignment_suggestions",
      input: {
        workItemId: "work-item-1",
        suggestions: [
          {
            id: "suggestion-1",
            title: "Fix assignment: Payer",
            description: "Fix typos.",
            section: "assignment",
            assignmentId: "assignment-1",
            suggestedText: "Corrected text",
          },
        ],
      },
    });

    expect(next[0]).toMatchObject({
      work_item_id: "work-item-1",
      status: "completed",
    });
  });

  it("marks a work item as no changes needed", () => {
    const current = applyRevisionToolCallToWorkItems([], {
      toolName: "set_revision_work_items",
      input: {
        summary: "Review",
        items: [
          {
            id: "work-item-1",
            title: "Review summary",
            description: "Check summary text.",
            section: "summary",
            status: "pending",
          },
        ],
      },
    });

    const next = applyRevisionToolCallToWorkItems(current, {
      toolName: "mark_revision_work_item_no_changes_needed",
      input: {
        workItemId: "work-item-1",
        note: "Already good.",
      },
    });

    expect(next[0]).toMatchObject({
      work_item_id: "work-item-1",
      status: "no_changes_needed",
      note: "Already good.",
    });
  });
});
