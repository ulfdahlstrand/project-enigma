import { describe, it, expect } from "vitest";
import { groupWorkItems, groupPlanActions } from "./group-work-items";
import type { RevisionPlan, RevisionWorkItems } from "../../lib/ai-tools/registries/resume-tools";

type PlanAction = RevisionPlan["actions"][number];

function planAction(overrides: Partial<PlanAction> & Pick<PlanAction, "id">): PlanAction {
  return {
    title: overrides.id,
    description: "",
    status: "pending",
    ...overrides,
  };
}

type WorkItem = RevisionWorkItems["items"][number];

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "section">): WorkItem {
  return {
    title: overrides.id,
    description: "",
    status: "pending",
    ...overrides,
  };
}

describe("groupWorkItems", () => {
  it("returns empty array for empty input", () => {
    expect(groupWorkItems([])).toEqual([]);
  });

  it("groups a single item into one group", () => {
    const items = [item({ id: "a", section: "presentation" })];
    const groups = groupWorkItems(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.section).toBe("presentation");
    expect(groups[0]!.items).toHaveLength(1);
  });

  it("groups items by section, preserving first-occurrence order", () => {
    const items = [
      item({ id: "a", section: "presentation" }),
      item({ id: "b", section: "skills" }),
      item({ id: "c", section: "presentation" }),
    ];
    const groups = groupWorkItems(items);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.section).toBe("presentation");
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[1]!.section).toBe("skills");
    expect(groups[1]!.items).toHaveLength(1);
  });

  it("normalizes section keys to lowercase for grouping", () => {
    const items = [
      item({ id: "a", section: "Skills" }),
      item({ id: "b", section: "skills" }),
      item({ id: "c", section: "SKILLS" }),
    ];
    const groups = groupWorkItems(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items).toHaveLength(3);
  });

  it("computes correct completedCount", () => {
    const items = [
      item({ id: "a", section: "presentation", status: "completed" }),
      item({ id: "b", section: "presentation", status: "no_changes_needed" }),
      item({ id: "c", section: "presentation", status: "pending" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.completedCount).toBe(2);
    expect(group!.totalCount).toBe(3);
  });

  it("sets isAllDone=true when all items are completed or no_changes_needed", () => {
    const items = [
      item({ id: "a", section: "skills", status: "completed" }),
      item({ id: "b", section: "skills", status: "no_changes_needed" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.isAllDone).toBe(true);
  });

  it("sets isAllDone=false when any item is pending", () => {
    const items = [
      item({ id: "a", section: "skills", status: "completed" }),
      item({ id: "b", section: "skills", status: "pending" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.isAllDone).toBe(false);
  });

  it("sets hasInProgress=true when any item is in_progress", () => {
    const items = [
      item({ id: "a", section: "assignment", status: "in_progress" }),
      item({ id: "b", section: "assignment", status: "pending" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.hasInProgress).toBe(true);
  });

  it("sets hasInProgress=false when no item is in_progress", () => {
    const items = [
      item({ id: "a", section: "assignment", status: "completed" }),
      item({ id: "b", section: "assignment", status: "pending" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.hasInProgress).toBe(false);
  });

  it("sets hasInProgress=false and isAllDone=false for all-pending group", () => {
    const items = [
      item({ id: "a", section: "summary", status: "pending" }),
      item({ id: "b", section: "summary", status: "pending" }),
    ];
    const [group] = groupWorkItems(items);
    expect(group!.hasInProgress).toBe(false);
    expect(group!.isAllDone).toBe(false);
  });

  it("handles mixed statuses across multiple groups independently", () => {
    const items = [
      item({ id: "a", section: "presentation", status: "completed" }),
      item({ id: "b", section: "skills", status: "in_progress" }),
      item({ id: "c", section: "skills", status: "pending" }),
    ];
    const groups = groupWorkItems(items);
    const presentation = groups.find((g) => g.section === "presentation")!;
    const skills = groups.find((g) => g.section === "skills")!;
    expect(presentation.isAllDone).toBe(true);
    expect(skills.hasInProgress).toBe(true);
    expect(skills.isAllDone).toBe(false);
  });
});

describe("groupPlanActions", () => {
  it("returns empty array for empty input", () => {
    expect(groupPlanActions([])).toEqual([]);
  });

  it("groups actions by inferred section", () => {
    const actions = [
      planAction({ id: "a", title: "Fix presentation text", description: "" }),
      planAction({ id: "b", title: "Fix skills section", description: "" }),
      planAction({ id: "c", title: "Update intro", description: "" }),
    ];
    const groups = groupPlanActions(actions);
    const presentation = groups.find((g) => g.section === "presentation")!;
    const skills = groups.find((g) => g.section === "skills")!;
    expect(presentation).toBeDefined();
    expect(skills).toBeDefined();
    expect(presentation.items).toHaveLength(2);
    expect(skills.items).toHaveLength(1);
  });

  it("groups assignment actions together using assignmentId", () => {
    const actions = [
      planAction({ id: "a", assignmentId: "asgn-1", title: "Improve description", description: "" }),
      planAction({ id: "b", assignmentId: "asgn-2", title: "Fix role title", description: "" }),
    ];
    const groups = groupPlanActions(actions);
    const assignments = groups.find((g) => g.section === "assignment")!;
    expect(assignments).toBeDefined();
    expect(assignments.items).toHaveLength(2);
  });

  it("maps done status to completedCount", () => {
    const actions = [
      planAction({ id: "a", title: "Fix presentation", description: "", status: "done" }),
      planAction({ id: "b", title: "Update intro", description: "", status: "pending" }),
    ];
    const [group] = groupPlanActions(actions);
    expect(group!.completedCount).toBe(1);
    expect(group!.totalCount).toBe(2);
    expect(group!.isAllDone).toBe(false);
  });

  it("sets isAllDone=true when all actions are done or skipped", () => {
    const actions = [
      planAction({ id: "a", title: "Fix presentation", description: "", status: "done" }),
      planAction({ id: "b", title: "Update intro", description: "", status: "skipped" }),
    ];
    const [group] = groupPlanActions(actions);
    expect(group!.isAllDone).toBe(true);
  });

  it("never sets hasInProgress since plan actions have no in_progress status", () => {
    const actions = [
      planAction({ id: "a", title: "Fix skills", description: "", status: "pending" }),
    ];
    const [group] = groupPlanActions(actions);
    expect(group!.hasInProgress).toBe(false);
  });
});
