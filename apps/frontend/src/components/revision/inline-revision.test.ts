import { describe, expect, it } from "vitest";
import {
  buildInlineRevisionWorkItemAutomationMessage,
  buildInlineRevisionWorkItemsFromPlan,
} from "./inline-revision";

describe("inline revision work items", () => {
  it("treats Swedish skill reordering actions as skills work", () => {
    const workItems = buildInlineRevisionWorkItemsFromPlan({
      summary: "Omorganisera färdigheter",
      actions: [
        {
          id: "action-skills",
          title: "Omorganisera färdigheter",
          description: "Sortera om färdighetsgrupper och färdigheter för att framhäva projektledning.",
          status: "pending",
        },
      ],
    });

    expect(workItems?.items[0]?.section).toBe("skills");
    expect(buildInlineRevisionWorkItemAutomationMessage(workItems)?.message).toContain(
      "Then replace the current action-stage worklist with explicit skills work items using set_revision_work_items.",
    );
  });

  it("keeps section-specific text inspection for non-skills work", () => {
    const workItems = buildInlineRevisionWorkItemsFromPlan({
      summary: "Fix summary",
      actions: [
        {
          id: "action-summary",
          title: "Review summary",
          description: "Fix the summary wording.",
          status: "pending",
        },
      ],
    });

    expect(workItems?.items[0]?.section).toBe("summary");
    expect(buildInlineRevisionWorkItemAutomationMessage(workItems)?.message).toContain(
      "Inspect the exact source text for section summary",
    );
  });

  it("uses direct skills inspection for narrow skills work", () => {
    const workItems = {
      summary: "Review one skill group",
      items: [
        {
          id: "action-skills-web",
          title: "Review web development ordering",
          description: "Sort the web development group internally.",
          section: "skills",
          status: "pending" as const,
        },
      ],
    };

    expect(buildInlineRevisionWorkItemAutomationMessage(workItems)?.message).toContain(
      "Inspect the current skills structure with inspect_resume_skills and decide the outcome for this work item only.",
    );
  });
});
