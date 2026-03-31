import { describe, expect, it } from "vitest";
import {
  buildInlineRevisionWorkItemAutomationMessage,
  buildInlineRevisionWorkItemsFromPlan,
  resolveRevisionWorkItems,
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
    expect(buildInlineRevisionWorkItemAutomationMessage(workItems)?.message).toContain(
      "reorder only the skills inside that group",
    );
  });

  it("does not treat named group ordering as a broad group-order task", () => {
    const workItems = {
      summary: "Review Arbetsomraden ordering",
      items: [
        {
          id: "action-skills-areas",
          title: "Review 'Arbetsområden' ordering",
          description: "Reorder the skills inside the 'Arbetsområden' group to highlight project leadership skills at the top without moving skills to a different group.",
          section: "skills",
          status: "pending" as const,
        },
      ],
    };

    const message = buildInlineRevisionWorkItemAutomationMessage(workItems)?.message ?? "";
    expect(message).toContain("reorder only the skills inside that group");
    expect(message).not.toContain("This is a broad skills-ordering task.");
    expect(message).not.toContain("set_revision_work_items");
  });

  it("requires broad group-order tasks to expand work items before suggestions", () => {
    const workItems = {
      summary: "Review overall skill group order",
      items: [
        {
          id: "action-skill-groups",
          title: "Review skill group order",
          description: "Reorder the existing skill groups to foreground leadership-related groups first.",
          section: "skills",
          status: "pending" as const,
        },
      ],
    };

    const message = buildInlineRevisionWorkItemAutomationMessage(workItems)?.message ?? "";
    expect(message).toContain("Your next tool call after inspection must be set_revision_work_items");
  });

  it("does not let a broad replacement collapse expanded skills work items", () => {
    const existing = {
      summary: "Skills reprioritization",
      items: [
        {
          id: "work-item-overall-group-order",
          title: "Review skill group order",
          description: "Reorder the skill groups to foreground leadership.",
          section: "skills",
          status: "pending" as const,
        },
        {
          id: "work-item-arbetsomraden",
          title: "Review arbetsomraden group ordering",
          description: "Reorder the skills inside arbetsomraden without moving them to another group.",
          section: "skills",
          status: "pending" as const,
        },
        {
          id: "work-item-specialkunskaper",
          title: "Review specialkunskaper group ordering",
          description: "Reorder the skills inside specialkunskaper without moving them to another group.",
          section: "skills",
          status: "pending" as const,
        },
      ],
    };

    const incoming = {
      summary: "Organisera om kunskapskategorier",
      items: [
        {
          id: "work-item-overall-group-order",
          title: "Ny ordning for kategorier",
          description: "Revisa och foresla en ny ordning for befintliga kunskapskategorier.",
          section: "skills",
          status: "pending" as const,
        },
      ],
    };

    expect(resolveRevisionWorkItems(existing, incoming)).toEqual({
      ...existing,
      summary: incoming.summary,
    });
  });
});
