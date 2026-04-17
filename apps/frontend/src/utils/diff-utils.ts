/**
 * Shared utilities for building structured diff groups from resume commit diffs.
 *
 * Used by useCommitDiff (hook) and CompareVersionsPage (display).
 */
import type { useResumeCommitDiff } from "../hooks/versioning";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export type DiffGroupItem = {
  key: string;
  title: string;
  before: string;
  after: string;
  status: DiffStatus;
  category?: string | null;
};

export type DiffGroup = {
  key: string;
  label: string;
  plusCount: number;
  minusCount: number;
  items: DiffGroupItem[];
};

type Diff = NonNullable<ReturnType<typeof useResumeCommitDiff>["data"]>["diff"];

export function countDiffContribution(status: DiffStatus): { plus: number; minus: number } {
  if (status === "added") return { plus: 1, minus: 0 };
  if (status === "removed") return { plus: 0, minus: 1 };
  if (status === "modified") return { plus: 1, minus: 1 };
  return { plus: 0, minus: 0 };
}

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => toDisplayText(item)).join("\n");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function stringifySkillEntry(entry: { name: string; category?: string | null } | undefined): string {
  if (!entry) return "";
  return entry.category ? `${entry.name}\n${entry.category}` : entry.name;
}

function stringifyAssignmentEntry(entry: Record<string, unknown> | undefined): string {
  if (!entry) return "";

  const technologies = Array.isArray(entry["technologies"])
    ? (entry["technologies"] as unknown[]).map((v) => String(v)).join(", ")
    : "";

  return [
    entry["clientName"] ? `Client: ${String(entry["clientName"])}` : "",
    entry["role"] ? `Role: ${String(entry["role"])}` : "",
    entry["description"] ? `Description:\n${toDisplayText(entry["description"])}` : "",
    technologies ? `Technologies: ${technologies}` : "",
    entry["keywords"] ? `Keywords: ${String(entry["keywords"])}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildDiffGroups(diff: Diff, t: (key: string) => string): DiffGroup[] {
  const scalarItems: DiffGroupItem[] = Object.entries(diff.scalars).flatMap(([field, change]) => {
    if (!change) return [];
    return [{
      key: field,
      title: field,
      before: toDisplayText(change.before),
      after: toDisplayText(change.after),
      status: "modified" as DiffStatus,
    }];
  });

  const skillItems: DiffGroupItem[] = diff.skills
    .filter((item) => item.status !== "unchanged")
    .map((item) => ({
      key: item.name,
      title: item.name,
      before: stringifySkillEntry(item.before),
      after: stringifySkillEntry(item.after),
      status: item.status as DiffStatus,
      category: item.after?.category ?? item.before?.category ?? null,
    }));

  const assignmentItems: DiffGroupItem[] = diff.assignments
    .filter((item) => item.status !== "unchanged")
    .map((item) => ({
      key: item.assignmentId,
      title: item.after?.clientName ?? item.before?.clientName ?? item.assignmentId,
      before: stringifyAssignmentEntry(item.before as Record<string, unknown> | undefined),
      after: stringifyAssignmentEntry(item.after as Record<string, unknown> | undefined),
      status: item.status as DiffStatus,
    }));

  return [
    { key: "scalars", label: t("resume.compare.scalarsHeading"), items: scalarItems, plusCount: 0, minusCount: 0 },
    { key: "skills", label: t("resume.compare.skillsHeading"), items: skillItems, plusCount: 0, minusCount: 0 },
    { key: "assignments", label: t("resume.compare.assignmentsHeading"), items: assignmentItems, plusCount: 0, minusCount: 0 },
  ]
    .map((group) => ({
      ...group,
      plusCount: group.items.reduce((sum, item) => sum + countDiffContribution(item.status).plus, 0),
      minusCount: group.items.reduce((sum, item) => sum + countDiffContribution(item.status).minus, 0),
    }))
    .filter((group) => group.items.length > 0);
}
