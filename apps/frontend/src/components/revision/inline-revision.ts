import type { RevisionPlan, RevisionSuggestions, RevisionWorkItems } from "../../lib/ai-tools/registries/resume-tools";

export type InlineRevisionStage = "planning" | "actions" | "finalize";

export const INLINE_REVISION_CHECKLIST_WIDTH = 300;
export const INLINE_REVISION_CHAT_WIDTH = 360;

const INLINE_REVISION_BRANCH_PREFIX = "AI revision";
const INLINE_REVISION_BRANCH_NAME_MAX_LENGTH = 72;

function normalizeInlineRevisionBranchLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.:;,[\]{}()]+/g, "")
    .trim();
}

export function buildInlineRevisionBranchName(plan: RevisionPlan) {
  const planLead =
    normalizeInlineRevisionBranchLabel(plan.actions[0]?.title ?? "") ||
    normalizeInlineRevisionBranchLabel(plan.summary);

  if (!planLead) {
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    return `${INLINE_REVISION_BRANCH_PREFIX} ${timestamp}`;
  }

  const branchName = `${INLINE_REVISION_BRANCH_PREFIX}: ${planLead}`;
  return branchName.length > INLINE_REVISION_BRANCH_NAME_MAX_LENGTH
    ? `${branchName.slice(0, INLINE_REVISION_BRANCH_NAME_MAX_LENGTH - 1).trimEnd()}…`
    : branchName;
}

export function buildInlineRevisionSuggestionCommitMessage(
  suggestion: RevisionSuggestions["suggestions"][number],
) {
  return `Apply AI suggestion: ${suggestion.title}`;
}

export function buildInlineRevisionWorkItemAutomationMessage(workItems: RevisionWorkItems | null) {
  if (!workItems || workItems.items.length === 0) {
    return null;
  }

  const nextPendingItem = workItems.items.find((item) => item.status === "pending");
  if (!nextPendingItem) {
    return null;
  }

  return {
    key: `process-${nextPendingItem.id}`,
    message: [
      `Process only this work item now: ${nextPendingItem.id}.`,
      `Title: ${nextPendingItem.title}.`,
      `Description: ${nextPendingItem.description}.`,
      nextPendingItem.assignmentId
        ? `Inspect assignment ${nextPendingItem.assignmentId} and decide the outcome for this work item only.`
        : `Inspect the exact source text for section ${nextPendingItem.section} and decide the outcome for this work item only.`,
      "If changes are needed, create suggestions for this work item.",
      "If no changes are needed, mark this work item as no changes needed.",
      "Do not revisit completed work items.",
      "Return a tool call now.",
    ].join(" "),
  };
}

export function buildInlineRevisionWorkItemsFromPlan(plan: RevisionPlan): RevisionWorkItems | null {
  const assignmentActions = plan.actions.filter((action) => action.assignmentId);

  if (assignmentActions.length === 0) {
    return null;
  }

  return {
    summary: plan.summary,
    items: assignmentActions.map((action, index) => ({
      id: action.id || `work-item-${index + 1}`,
      title: action.title,
      description: action.description,
      section: "assignment",
      assignmentId: action.assignmentId,
      status: "pending" as const,
    })),
  };
}

export function appendUniqueRevisionSuggestions(
  existing: RevisionSuggestions | null,
  incoming: RevisionSuggestions,
): RevisionSuggestions {
  if (!existing) {
    return incoming;
  }

  const nextSuggestions = [...existing.suggestions];

  for (const suggestion of incoming.suggestions) {
    const existingIndex = nextSuggestions.findIndex((item) => item.id === suggestion.id);

    if (existingIndex >= 0) {
      nextSuggestions[existingIndex] = suggestion;
    } else {
      nextSuggestions.push(suggestion);
    }
  }

  return {
    summary: incoming.summary || existing.summary,
    suggestions: nextSuggestions,
  };
}
