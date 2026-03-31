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

function isBroadSkillsWorkItem(item: RevisionWorkItems["items"][number]) {
  if (item.section !== "skills") {
    return false;
  }

  const haystack = `${item.title} ${item.description}`.toLowerCase();
  const mentionsSpecificGroup =
    haystack.includes("'")
    || haystack.includes("\"")
    || haystack.includes(" inside ")
    || haystack.includes(" within ")
    || haystack.includes(" i grupp")
    || haystack.includes(" inom grupp")
    || haystack.includes("inne i grupp")
    || haystack.includes("utan att flytta")
    || haystack.includes("without moving")
    || haystack.includes("specific group")
    || haystack.includes("named group");

  const mentionsGroupContainers =
    haystack.includes("group order")
    || haystack.includes("groups")
    || haystack.includes("groupes")
    || haystack.includes("grupper")
    || haystack.includes("categories")
    || haystack.includes("kategorier")
    || haystack.includes("kunskapskategorier")
    || haystack.includes("färdighetsgrupper");

  if (mentionsSpecificGroup) {
    return false;
  }

  return (
    mentionsGroupContainers
    && (
      haystack.includes("reorder")
      || haystack.includes("repriorit")
      || haystack.includes("reorgan")
      || haystack.includes("restruct")
      || haystack.includes("sortera")
      || haystack.includes("prioriter")
      || haystack.includes("omorgan")
      || haystack.includes("omstruktur")
      || haystack.includes("ordning")
      || haystack.includes("ordna")
    )
  );
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
      isBroadSkillsWorkItem(nextPendingItem)
        ? [
            "This is a broad skills-ordering task.",
            "First inspect the current skills structure with inspect_resume_skills.",
            "Then replace the current action-stage worklist with explicit skills work items using set_revision_work_items.",
            "Your next tool call after inspection must be set_revision_work_items, not set_revision_suggestions.",
            "Create one work item for overall group order, then one work item per affected group for internal skill ordering.",
            "Do not create work items for inventing new categories or moving skills between categories unless the user explicitly asked for regrouping.",
            "Do not propose concrete suggestions yet in this first response after inspection.",
          ].join(" ")
        : nextPendingItem.assignmentId
        ? `Inspect assignment ${nextPendingItem.assignmentId} and decide the outcome for this work item only.`
        : nextPendingItem.section === "skills"
          ? [
              "Inspect the current skills structure with inspect_resume_skills and decide the outcome for this work item only.",
              "If this work item names a specific skills group, reorder only the skills inside that group.",
              'Treat phrases like "<group> group ordering" as internal ordering within that named group, not as reordering the groups themselves.',
              "Do not reorder the overall group order unless this work item explicitly asks for that.",
              "Do not move skills between groups.",
            ].join(" ")
          : `Inspect the exact source text for section ${nextPendingItem.section} and decide the outcome for this work item only.`,
      "If changes are needed, create suggestions for this work item.",
      "If no changes are needed, mark this work item as no changes needed.",
      "Do not revisit completed work items.",
      "Return a tool call now.",
    ].join(" "),
  };
}

export function resolveRevisionWorkItems(
  existing: RevisionWorkItems | null,
  incoming: RevisionWorkItems,
): RevisionWorkItems {
  if (!existing) {
    return incoming;
  }

  const existingSkillItems = existing.items.filter((item) => item.section === "skills");
  const incomingSkillItems = incoming.items.filter((item) => item.section === "skills");
  const existingHasExpandedSkills = existingSkillItems.some((item) => !isBroadSkillsWorkItem(item));
  const incomingHasExpandedSkills = incomingSkillItems.some((item) => !isBroadSkillsWorkItem(item));

  const incomingCollapsesExpandedSkills =
    existingHasExpandedSkills
    && incomingSkillItems.length > 0
    && !incomingHasExpandedSkills
    && incomingSkillItems.length < existingSkillItems.length;

  if (!incomingCollapsesExpandedSkills) {
    return incoming;
  }

  return {
    ...existing,
    summary: incoming.summary || existing.summary,
  };
}

export function buildInlineRevisionWorkItemsFromPlan(plan: RevisionPlan): RevisionWorkItems | null {
  if (plan.actions.length === 0) {
    return null;
  }

  return {
    summary: plan.summary,
    items: plan.actions.map((action, index) => ({
      id: action.id || `work-item-${index + 1}`,
      title: action.title,
      description: action.description,
      section: inferRevisionWorkItemSection(action),
      assignmentId: action.assignmentId,
      status: "pending" as const,
    })),
  };
}

export function inferRevisionWorkItemSection(action: RevisionPlan["actions"][number]): string {
  if (action.assignmentId) {
    return "assignment";
  }

  const haystack = `${action.title} ${action.description}`.toLowerCase();

  if (haystack.includes("presentation") || haystack.includes("profil") || haystack.includes("intro")) {
    return "presentation";
  }

  if (haystack.includes("summary") || haystack.includes("sammanfatt")) {
    return "summary";
  }

  if (haystack.includes("consultant title") || haystack.includes("konsulttitel") || haystack.includes("title")) {
    return "consultantTitle";
  }

  if (
    haystack.includes("skill")
    || haystack.includes("kompetens")
    || haystack.includes("färdighet")
  ) {
    return "skills";
  }

  return "presentation";
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

export function markWorkItemsCompletedFromSuggestions(
  workItems: RevisionWorkItems | null,
  suggestions: RevisionSuggestions,
): RevisionWorkItems | null {
  if (!workItems) {
    return workItems;
  }

  const completedIds = new Set<string>();

  for (const suggestion of suggestions.suggestions) {
    const prefixedWorkItemId = suggestion.id.split(":")[0] ?? suggestion.id;
    if (workItems.items.some((item) => item.id === prefixedWorkItemId)) {
      completedIds.add(prefixedWorkItemId);
      continue;
    }

    const matchingItem = workItems.items.find((item) => {
      if (item.status === "completed" || item.status === "no_changes_needed") {
        return false;
      }

      if (suggestion.assignmentId && item.assignmentId) {
        return item.assignmentId === suggestion.assignmentId;
      }

      return item.section.trim().toLowerCase() === suggestion.section.trim().toLowerCase();
    });

    if (matchingItem) {
      completedIds.add(matchingItem.id);
    }
  }

  if (completedIds.size === 0) {
    return workItems;
  }

  return {
    ...workItems,
    items: workItems.items.map((item) =>
      completedIds.has(item.id) ? { ...item, status: "completed" } : item,
    ),
  };
}
