import type { Kysely } from "kysely";
import type {
  AIRevisionWorkItem,
  AIRevisionWorkItemStatus,
  Database,
  NewAIRevisionWorkItem,
} from "../../../db/types.js";

type WorkItemToolName =
  | "set_revision_work_items"
  | "mark_revision_work_item_no_changes_needed"
  | "set_assignment_suggestions"
  | "set_revision_suggestions";

type PersistedWorkItem = Pick<
  AIRevisionWorkItem,
  | "work_item_id"
  | "title"
  | "description"
  | "section"
  | "assignment_id"
  | "status"
  | "note"
  | "position"
  | "attempt_count"
  | "last_error"
  | "payload"
  | "completed_at"
>;

type ToolCallInput = {
  toolName: string;
  input: unknown;
};

type RevisionWorkItemInput = {
  id: string;
  title: string;
  description: string;
  section: string;
  assignmentId?: string;
  status?: string;
  note?: string;
};

type RevisionSuggestionInput = {
  id?: string;
  section?: string;
  assignmentId?: string;
};

const PERSISTED_WORK_ITEM_TOOLS = new Set<WorkItemToolName>([
  "set_revision_work_items",
  "mark_revision_work_item_no_changes_needed",
  "set_assignment_suggestions",
  "set_revision_suggestions",
]);

function normalizeStatus(status: string | undefined): AIRevisionWorkItemStatus {
  if (
    status === "pending"
    || status === "in_progress"
    || status === "completed"
    || status === "no_changes_needed"
    || status === "failed"
    || status === "blocked"
  ) {
    return status;
  }

  return "pending";
}

function completedAtForStatus(status: AIRevisionWorkItemStatus) {
  return status === "completed" || status === "no_changes_needed" ? new Date() : null;
}

function parseSetRevisionWorkItemsInput(input: unknown): RevisionWorkItemInput[] {
  if (
    typeof input !== "object"
    || input === null
    || !("items" in input)
    || !Array.isArray((input as { items?: unknown[] }).items)
  ) {
    return [];
  }

  return (input as { items: unknown[] }).items.flatMap((item) => {
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

    return [{
      id: row.id,
      title: row.title,
      description: row.description,
      section: row.section,
      ...(typeof row.assignmentId === "string" ? { assignmentId: row.assignmentId } : {}),
      ...(typeof row.status === "string" ? { status: row.status } : {}),
      ...(typeof row.note === "string" ? { note: row.note } : {}),
    }];
  });
}

function parseSuggestions(input: unknown): RevisionSuggestionInput[] {
  if (
    typeof input !== "object"
    || input === null
    || !("suggestions" in input)
    || !Array.isArray((input as { suggestions?: unknown[] }).suggestions)
  ) {
    return [];
  }

  return (input as { suggestions: unknown[] }).suggestions.flatMap((suggestion) => {
    if (typeof suggestion !== "object" || suggestion === null) {
      return [];
    }

    const row = suggestion as Record<string, unknown>;
    return [{
      ...(typeof row.id === "string" ? { id: row.id } : {}),
      ...(typeof row.section === "string" ? { section: row.section } : {}),
      ...(typeof row.assignmentId === "string" ? { assignmentId: row.assignmentId } : {}),
    }];
  });
}

function markWorkItemById(
  items: PersistedWorkItem[],
  workItemId: string,
  status: AIRevisionWorkItemStatus,
  note?: string,
) {
  return items.map((item) =>
    item.work_item_id === workItemId
      ? {
          ...item,
          status,
          note: note ?? item.note,
          completed_at: completedAtForStatus(status),
        }
      : item,
  );
}

function markWorkItemsFromSuggestions(items: PersistedWorkItem[], input: unknown) {
  const suggestions = parseSuggestions(input);
  let nextItems = items;

  for (const suggestion of suggestions) {
    const directId = suggestion.id?.split(":")[0];
    if (directId && nextItems.some((item) => item.work_item_id === directId)) {
      nextItems = markWorkItemById(nextItems, directId, "completed");
      continue;
    }

    const assignmentId = suggestion.assignmentId;
    const section = suggestion.section?.trim().toLowerCase();
    const match = nextItems.find((item) => {
      if (item.status === "completed" || item.status === "no_changes_needed") {
        return false;
      }

      if (assignmentId && item.assignment_id) {
        return item.assignment_id === assignmentId;
      }

      return section ? item.section.trim().toLowerCase() === section : false;
    });

    if (match) {
      nextItems = markWorkItemById(nextItems, match.work_item_id, "completed");
    }
  }

  return nextItems;
}

export function isPersistedRevisionWorkItemTool(toolName: string): toolName is WorkItemToolName {
  return PERSISTED_WORK_ITEM_TOOLS.has(toolName as WorkItemToolName);
}

export function applyRevisionToolCallToWorkItems(
  currentItems: PersistedWorkItem[],
  toolCall: ToolCallInput,
): PersistedWorkItem[] {
  if (!isPersistedRevisionWorkItemTool(toolCall.toolName)) {
    return currentItems;
  }

  if (toolCall.toolName === "set_revision_work_items") {
    return parseSetRevisionWorkItemsInput(toolCall.input).map((item, index) => {
      const status = normalizeStatus(item.status);
      return {
        work_item_id: item.id,
        title: item.title,
        description: item.description,
        section: item.section,
        assignment_id: item.assignmentId ?? null,
        status,
        note: item.note ?? null,
        position: index,
        attempt_count: 0,
        last_error: null,
        payload: item,
        completed_at: completedAtForStatus(status),
      };
    });
  }

  if (toolCall.toolName === "mark_revision_work_item_no_changes_needed") {
    const input = toolCall.input as { workItemId?: unknown; note?: unknown } | undefined;
    if (typeof input?.workItemId !== "string") {
      return currentItems;
    }

    return markWorkItemById(
      currentItems,
      input.workItemId,
      "no_changes_needed",
      typeof input.note === "string" ? input.note : undefined,
    );
  }

  if (toolCall.toolName === "set_assignment_suggestions") {
    const input = toolCall.input as { workItemId?: unknown } | undefined;
    if (typeof input?.workItemId !== "string") {
      return currentItems;
    }

    return markWorkItemById(currentItems, input.workItemId, "completed");
  }

  return markWorkItemsFromSuggestions(currentItems, toolCall.input);
}

function toInsertableRows(
  conversationId: string,
  branchId: string,
  items: PersistedWorkItem[],
): NewAIRevisionWorkItem[] {
  return items.map((item) => ({
    conversation_id: conversationId,
    branch_id: branchId,
    work_item_id: item.work_item_id,
    title: item.title,
    description: item.description,
    section: item.section,
    assignment_id: item.assignment_id,
    status: item.status,
    note: item.note,
    position: item.position,
    attempt_count: item.attempt_count,
    last_error: item.last_error,
    payload: item.payload,
    completed_at: item.completed_at,
  }));
}

export async function listPersistedRevisionWorkItems(
  db: Kysely<Database>,
  conversationId: string,
) {
  return db
    .selectFrom("ai_revision_work_items")
    .selectAll()
    .where("conversation_id", "=", conversationId)
    .orderBy("position", "asc")
    .execute();
}

export async function persistRevisionToolCallWorkItems(
  db: Kysely<Database>,
  input: {
    conversationId: string;
    branchId: string;
    toolName: string;
    toolCallInput: unknown;
  },
) {
  if (!isPersistedRevisionWorkItemTool(input.toolName)) {
    return false;
  }

  const currentItems = await listPersistedRevisionWorkItems(db, input.conversationId);
  const nextItems = applyRevisionToolCallToWorkItems(currentItems, {
    toolName: input.toolName,
    input: input.toolCallInput,
  });

  await db.deleteFrom("ai_revision_work_items").where("conversation_id", "=", input.conversationId).execute();

  if (nextItems.length > 0) {
    await db
      .insertInto("ai_revision_work_items")
      .values(toInsertableRows(input.conversationId, input.branchId, nextItems))
      .execute();
  }

  return true;
}
