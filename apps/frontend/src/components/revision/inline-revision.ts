import type { RevisionPlan, RevisionSuggestions, RevisionWorkItems } from "../../lib/ai-tools/registries/resume-tool-schemas";

export type InlineRevisionStage = "revision" | "finalize";

export const INLINE_REVISION_CHECKLIST_WIDTH = 300;
export const INLINE_REVISION_CHAT_WIDTH = 360;

const INLINE_REVISION_BRANCH_NAME_MAX_LENGTH = 72;

function normalizeInlineRevisionBranchLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.:;,[\]{}()]+/g, "")
    .trim();
}

function slugifyInlineRevisionBranchLabel(value: string) {
  return normalizeInlineRevisionBranchLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildInlineRevisionBranchNameFromGoal(goal: string | null | undefined) {
  const normalizedGoal = goal ? slugifyInlineRevisionBranchLabel(goal) : "";

  if (!normalizedGoal) {
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[TZ:]/g, "-");
    return `revision/${timestamp}`;
  }

  const branchName = `revision/${normalizedGoal}`;
  return branchName.length > INLINE_REVISION_BRANCH_NAME_MAX_LENGTH
    ? `${branchName.slice(0, INLINE_REVISION_BRANCH_NAME_MAX_LENGTH - 1).trimEnd()}…`
    : branchName;
}

export function buildInlineRevisionSuggestionCommitTitle(
  suggestion: RevisionSuggestions["suggestions"][number],
) {
  return `ai(suggestion): ${suggestion.title}`;
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
      const existingSuggestion = nextSuggestions[existingIndex];
      if (!existingSuggestion) {
        nextSuggestions.push(suggestion);
        continue;
      }
      nextSuggestions[existingIndex] = {
        ...suggestion,
        status:
          existingSuggestion.status !== "pending" && suggestion.status === "pending"
            ? existingSuggestion.status
            : suggestion.status,
      };
    } else {
      nextSuggestions.push(suggestion);
    }
  }

  return {
    summary: incoming.summary || existing.summary,
    suggestions: nextSuggestions,
  };
}

export function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeSkillsSignature(
  skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>,
) {
  return JSON.stringify(
    [...skills]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((skill) => ({
        name: skill.name.trim(),
        level: skill.level ?? null,
        category: skill.category ?? null,
        sortOrder: skill.sortOrder,
      })),
  );
}

export function reconcileRevisionSuggestionsWithCurrentContent(
  suggestions: RevisionSuggestions | null,
  current: {
    title: string;
    consultantTitle: string | null;
    presentation: string[];
    summary: string | null;
    skills: Array<{ name: string; level: string | null; category: string | null; sortOrder: number }>;
    assignments: Array<{ id: string; description?: string }>;
  },
): RevisionSuggestions | null {
  if (!suggestions) {
    return null;
  }

  const currentSkillsSignature = normalizeSkillsSignature(current.skills);

  return {
    ...suggestions,
    suggestions: suggestions.suggestions.map((suggestion) => {
      if (suggestion.status === "dismissed") {
        return suggestion;
      }

      const section = suggestion.section.trim().toLowerCase();
      let isApplied = false;

      if (suggestion.skills && suggestion.skills.length > 0) {
        isApplied = normalizeSkillsSignature(suggestion.skills.map((skill) => ({
          name: skill.name,
          level: skill.level ?? null,
          category: skill.category,
          sortOrder: skill.sortOrder,
        }))) === currentSkillsSignature;
      } else if (suggestion.assignmentId) {
        const assignment = current.assignments.find((item) => item.id === suggestion.assignmentId);
        isApplied = normalizeComparableText(assignment?.description) === normalizeComparableText(suggestion.suggestedText);
      } else if (section.includes("consultant")) {
        isApplied = normalizeComparableText(current.consultantTitle) === normalizeComparableText(suggestion.suggestedText);
      } else if (section.includes("presentation") || section.includes("profil") || section.includes("intro")) {
        isApplied = normalizeComparableText(current.presentation.join("\n\n")) === normalizeComparableText(suggestion.suggestedText);
      } else if (section.includes("summary") || section.includes("sammanfatt")) {
        isApplied = normalizeComparableText(current.summary) === normalizeComparableText(suggestion.suggestedText);
      } else if (section.includes("title") || section.includes("titel")) {
        isApplied = normalizeComparableText(current.title) === normalizeComparableText(suggestion.suggestedText);
      }

      return isApplied ? { ...suggestion, status: "accepted" as const } : suggestion;
    }),
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
