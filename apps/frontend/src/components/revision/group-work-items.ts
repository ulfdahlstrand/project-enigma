import type { RevisionPlan, RevisionWorkItems } from "../../lib/ai-tools/registries/resume-tools";
import { inferRevisionWorkItemSection } from "./inline-revision";

type WorkItem = RevisionWorkItems["items"][number];

type PlanAction = RevisionPlan["actions"][number];

export type WorkItemGroup = {
  section: string;
  items: WorkItem[];
  completedCount: number;
  totalCount: number;
  hasInProgress: boolean;
  isAllDone: boolean;
};

export type PlanActionGroup = {
  section: string;
  items: PlanAction[];
  completedCount: number;
  totalCount: number;
  hasInProgress: boolean;
  isAllDone: boolean;
};

export function groupPlanActions(actions: PlanAction[]): PlanActionGroup[] {
  const order: string[] = [];
  const bySection = new Map<string, PlanAction[]>();

  for (const action of actions) {
    const key = inferRevisionWorkItemSection(action).toLowerCase();
    if (!bySection.has(key)) {
      order.push(key);
      bySection.set(key, []);
    }
    bySection.get(key)!.push(action);
  }

  return order.map((key) => {
    const groupItems = bySection.get(key)!;
    const completedCount = groupItems.filter(
      (a) => a.status === "done" || a.status === "skipped",
    ).length;
    const isAllDone = groupItems.every(
      (a) => a.status === "done" || a.status === "skipped",
    );

    return {
      section: key,
      items: groupItems,
      completedCount,
      totalCount: groupItems.length,
      hasInProgress: false,
      isAllDone,
    };
  });
}

export function groupWorkItems(items: WorkItem[]): WorkItemGroup[] {
  const order: string[] = [];
  const bySection = new Map<string, WorkItem[]>();

  for (const item of items) {
    const key = item.section.toLowerCase();
    if (!bySection.has(key)) {
      order.push(key);
      bySection.set(key, []);
    }
    bySection.get(key)!.push(item);
  }

  return order.map((key) => {
    const groupItems = bySection.get(key)!;
    const completedCount = groupItems.filter(
      (i) => i.status === "completed" || i.status === "no_changes_needed",
    ).length;
    const hasInProgress = groupItems.some((i) => i.status === "in_progress");
    const isAllDone = groupItems.every(
      (i) => i.status === "completed" || i.status === "no_changes_needed",
    );

    return {
      section: key,
      items: groupItems,
      completedCount,
      totalCount: groupItems.length,
      hasInProgress,
      isAllDone,
    };
  });
}
