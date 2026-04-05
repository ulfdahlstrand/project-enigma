import {
  INTERNAL_AUTOSTART_PREFIX,
  INTERNAL_GUARDRAIL_PREFIX,
  extractToolCalls,
  extractJsonBlocks,
} from "./tool-parsing.js";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type ActionWorkItem = {
  id: string;
  title: string;
  description: string;
  section: string;
  assignmentId?: string;
  status: "pending" | "in_progress" | "completed" | "no_changes_needed";
  note?: string;
};

type ActionWorkItemLike = {
  id: string;
  title: string;
  description: string;
  section: string;
  assignmentId?: string;
  status: string;
  note?: string;
};

const PLANNING_GUARDRAIL_MESSAGE = [
  "You must use the available tools for this stage.",
  "Inspect the resume if needed and then create the agreed revision plan with set_revision_plan.",
  "If the user's goal is broad, such as proofreading the whole CV, the plan must include multiple section-based actions and must not collapse to a single typo or a single section.",
  "Do not continue with free-text execution updates until the plan has been created.",
  "Return a tool call now.",
].join(" ");

const ACTION_GUARDRAIL_MESSAGE = [
  "You must use the available tools for this stage.",
  "Use the approved plan that was already provided in the kickoff context.",
  "The approved work items already define the allowed scope for this action step.",
  "Do not create extra work items or inspect assignments outside the approved plan.",
  "After inspecting the source text for a work item, your next response must be a terminal tool call for that same work item.",
  "Use set_assignment_suggestions or set_revision_suggestions if changes are needed, or mark_revision_work_item_no_changes_needed if none are needed.",
  "Do not respond with plain text between inspect_assignment or inspect_resume_section and that terminal tool call.",
  "Use inspect_assignment or inspect_resume_section to read exact source text for each work item.",
  "For each work item, either create concrete suggestions or mark it as no changes needed.",
  "Do not claim that changes are applied or complete until every work item has been handled.",
  "Return a tool call now.",
].join(" ");

function isBroadSkillsWorkItem(item: ActionWorkItem) {
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

function isBroadAssignmentWorkItem(item: ActionWorkItem) {
  return item.section === "assignment" && !item.assignmentId;
}

function parseActionWorkItems(input: unknown): ActionWorkItem[] | null {
  if (
    typeof input !== "object"
    || input === null
    || !("items" in input)
    || !Array.isArray((input as { items?: unknown[] }).items)
  ) {
    return null;
  }

  const items = (input as { items: unknown[] }).items
    .flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }

      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== "string"
        || typeof row.title !== "string"
        || typeof row.description !== "string"
        || typeof row.section !== "string"
      ) {
        return [];
      }

      const status =
        row.status === "completed"
        || row.status === "no_changes_needed"
        || row.status === "in_progress"
          ? row.status
          : "pending";

      return [{
        id: row.id,
        title: row.title,
        description: row.description,
        section: row.section,
        ...(typeof row.assignmentId === "string" ? { assignmentId: row.assignmentId } : {}),
        status,
        ...(typeof row.note === "string" ? { note: row.note } : {}),
      } satisfies ActionWorkItem];
    });

  return items.length > 0 ? items : null;
}

function buildNextWorkItemAutomationMessage(workItems: ActionWorkItem[] | null) {
  if (!workItems || workItems.length === 0) {
    return null;
  }

  const nextPendingItem = workItems.find((item) => item.status === "pending");
  if (!nextPendingItem) {
    return null;
  }

  return [
    `Process only this work item now: ${nextPendingItem.id}.`,
    `Title: ${nextPendingItem.title}.`,
    `Description: ${nextPendingItem.description}.`,
    isBroadAssignmentWorkItem(nextPendingItem)
      ? [
          "This is a broad assignment-review task.",
          "First inspect the available assignments with list_resume_assignments.",
          "Then replace the current action-stage worklist with explicit assignment work items using set_revision_work_items.",
          "Create one work item per assignment that must be reviewed.",
          "Do not propose concrete suggestions yet in this first response after inspection.",
        ].join(" ")
      : isBroadSkillsWorkItem(nextPendingItem)
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
              "If this work item still covers skills broadly, replace it with more explicit skills work items using set_revision_work_items before creating suggestions.",
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
  ].join(" ");
}

export function deriveNextActionOrchestrationMessageFromWorkItems(
  workItems: ActionWorkItemLike[] | null,
) {
  if (!workItems || workItems.length === 0) {
    return null;
  }

  const normalizedItems: ActionWorkItem[] = workItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    section: item.section,
    ...(item.assignmentId ? { assignmentId: item.assignmentId } : {}),
    status:
      item.status === "completed"
      || item.status === "no_changes_needed"
      || item.status === "in_progress"
        ? item.status
        : "pending",
    ...(item.note ? { note: item.note } : {}),
  }));

  return buildNextWorkItemAutomationMessage(normalizedItems);
}

function markWorkItemById(items: ActionWorkItem[], workItemId: string, status: ActionWorkItem["status"]) {
  return items.map((item) => (item.id === workItemId ? { ...item, status } : item));
}

function markWorkItemsFromSuggestions(items: ActionWorkItem[], input: unknown, prefixed = false) {
  if (
    typeof input !== "object"
    || input === null
    || !("suggestions" in input)
    || !Array.isArray((input as { suggestions?: unknown[] }).suggestions)
  ) {
    return items;
  }

  let nextItems = items;
  for (const suggestion of (input as { suggestions: unknown[] }).suggestions) {
    if (typeof suggestion !== "object" || suggestion === null) {
      continue;
    }

    const row = suggestion as Record<string, unknown>;
    const directId =
      typeof row.id === "string"
        ? (prefixed ? row.id.split(":")[0] : row.id)
        : null;

    if (directId && nextItems.some((item) => item.id === directId)) {
      nextItems = markWorkItemById(nextItems, directId, "completed");
      continue;
    }

    const assignmentId = typeof row.assignmentId === "string" ? row.assignmentId : undefined;
    const section = typeof row.section === "string" ? row.section.trim().toLowerCase() : undefined;
    const match = nextItems.find((item) => {
      if (item.status === "completed" || item.status === "no_changes_needed") {
        return false;
      }

      if (assignmentId && item.assignmentId) {
        return item.assignmentId === assignmentId;
      }

      return section ? item.section.trim().toLowerCase() === section : false;
    });

    if (match) {
      nextItems = markWorkItemById(nextItems, match.id, "completed");
    }
  }

  return nextItems;
}

export function deriveNextActionOrchestrationMessage(messages: ConversationMessage[]) {
  let workItems: ActionWorkItem[] | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const parsed of extractJsonBlocks(message.content)) {
      if (
        typeof parsed !== "object"
        || parsed === null
        || (parsed as { type?: unknown }).type !== "tool_call"
        || typeof (parsed as { toolName?: unknown }).toolName !== "string"
      ) {
        continue;
      }

      const toolCall = parsed as { toolName: string; input?: unknown };

      if (toolCall.toolName === "set_revision_work_items") {
        const parsedItems = parseActionWorkItems(toolCall.input);
        if (parsedItems) {
          workItems = parsedItems;
        }
        continue;
      }

      if (!workItems) {
        continue;
      }

      if (toolCall.toolName === "mark_revision_work_item_no_changes_needed") {
        const input = toolCall.input as { workItemId?: unknown } | undefined;
        if (typeof input?.workItemId === "string") {
          workItems = markWorkItemById(workItems, input.workItemId, "no_changes_needed");
        }
        continue;
      }

      if (toolCall.toolName === "set_assignment_suggestions") {
        const input = toolCall.input as { workItemId?: unknown } | undefined;
        if (typeof input?.workItemId === "string") {
          workItems = markWorkItemById(workItems, input.workItemId, "completed");
        }
        continue;
      }

      if (toolCall.toolName === "set_revision_suggestions") {
        workItems = markWorkItemsFromSuggestions(workItems, toolCall.input, true);
      }
    }
  }

  const automationMessage = buildNextWorkItemAutomationMessage(workItems);
  if (!automationMessage) {
    return null;
  }

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null;
  const autoStartContent = `${INTERNAL_AUTOSTART_PREFIX} ${automationMessage}`;
  const guardrailContent = `${INTERNAL_GUARDRAIL_PREFIX} ${ACTION_GUARDRAIL_MESSAGE}`;

  if (latestUserMessage === autoStartContent) {
    return { kind: "guardrail" as const, content: guardrailContent };
  }

  if (latestUserMessage === guardrailContent) {
    return null;
  }

  return { kind: "automation" as const, content: autoStartContent };
}

export function deriveNextPlanningOrchestrationMessage(messages: ConversationMessage[]) {
  let hasPlan = false;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const parsed of extractJsonBlocks(message.content)) {
      if (
        typeof parsed === "object"
        && parsed !== null
        && (parsed as { type?: unknown }).type === "tool_call"
        && (parsed as { toolName?: unknown }).toolName === "set_revision_plan"
      ) {
        hasPlan = true;
      }
    }
  }

  if (hasPlan) {
    return null;
  }

  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  if (!latestAssistantMessage) {
    return null;
  }

  if (extractToolCalls(latestAssistantMessage.content).length > 0) {
    return null;
  }

  const guardrailContent = `${INTERNAL_GUARDRAIL_PREFIX} ${PLANNING_GUARDRAIL_MESSAGE}`;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null;
  if (latestUserMessage === guardrailContent) {
    return null;
  }

  return { kind: "guardrail" as const, content: guardrailContent };
}
