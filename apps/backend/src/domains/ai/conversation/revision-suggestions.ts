import type { Kysely } from "kysely";
import type {
  AIRevisionSuggestion,
  AIRevisionSuggestionStatus,
  Database,
  NewAIRevisionSuggestion,
  ResumeCommitContent,
} from "../../../db/types.js";
import { parseRevisionToolArguments } from "./revision-tools.js";
import { listPersistedRevisionWorkItems } from "./revision-work-items.js";
import { readTreeContent } from "../../resume/lib/read-tree-content.js";

type SuggestionToolName =
  | "set_assignment_suggestions"
  | "set_revision_suggestions";

type OriginalTextMap = {
  title: string | null;
  consultantTitle: string | null;
  presentation: string | null;
  summary: string | null;
  assignments: Map<string, string>;
};

type PersistedSuggestion = Pick<
  AIRevisionSuggestion,
  | "work_item_id"
  | "suggestion_id"
  | "summary"
  | "title"
  | "description"
  | "section"
  | "assignment_id"
  | "suggested_text"
  | "status"
  | "skills"
  | "skill_scope"
  | "payload"
  | "resolved_at"
>;

type PersistedWorkItem = {
  work_item_id: string;
  section: string;
  assignment_id: string | null;
  status: string;
};

type SuggestionInput = {
  id: string;
  title: string;
  description: string;
  section: string;
  assignmentId?: string;
  suggestedText: string;
  skills?: unknown;
  skillScope?: unknown;
  status?: string;
};

async function fetchOriginalTexts(
  db: Kysely<Database>,
  branchId: string,
): Promise<OriginalTextMap> {
  const branch = await db
    .selectFrom("resume_branches")
    .select(["head_commit_id", "forked_from_commit_id"])
    .where("id", "=", branchId)
    .executeTakeFirst();

  const commitId = branch?.head_commit_id ?? branch?.forked_from_commit_id ?? null;
  let content: ResumeCommitContent | null = null;

  if (commitId) {
    const commit = await db
      .selectFrom("resume_commits")
      .select("tree_id")
      .where("id", "=", commitId)
      .executeTakeFirst();
    content = commit?.tree_id ? await readTreeContent(db, commit.tree_id) : null;
  }

  const rawAssignments = await db
    .selectFrom("branch_assignments")
    .select(["assignment_id", "description"])
    .where("branch_id", "=", branchId)
    .execute();

  const assignments = new Map<string, string>();
  for (const a of rawAssignments) {
    assignments.set(a.assignment_id, a.description);
  }

  return {
    title: content?.title ?? null,
    consultantTitle: content?.consultantTitle ?? null,
    presentation: content?.presentation ? content.presentation.join("\n\n") : null,
    summary: content?.summary ?? null,
    assignments,
  };
}

function getOriginalText(
  originalTexts: OriginalTextMap,
  section: string,
  assignmentId: string | undefined,
): string | null {
  if (section === "title") return originalTexts.title;
  if (section === "consultantTitle") return originalTexts.consultantTitle;
  if (section === "presentation") return originalTexts.presentation;
  if (section === "summary") return originalTexts.summary;
  if (section === "assignment" && assignmentId) {
    return originalTexts.assignments.get(assignmentId) ?? null;
  }
  return null;
}

function normalizeStatus(status: string | undefined): AIRevisionSuggestionStatus {
  if (
    status === "pending"
    || status === "accepted"
    || status === "dismissed"
    || status === "applied"
  ) {
    return status;
  }

  return "pending";
}

function resolvedAtForStatus(status: AIRevisionSuggestionStatus) {
  return status === "accepted" || status === "dismissed" || status === "applied"
    ? new Date()
    : null;
}

function normalizeSuggestionRows(
  toolName: SuggestionToolName,
  input: unknown,
  currentWorkItems: PersistedWorkItem[],
  originalTexts: OriginalTextMap,
): Array<PersistedSuggestion> {
  const parsed = parseRevisionToolArguments(toolName, JSON.stringify(input)) as {
    summary?: string;
    suggestions: SuggestionInput[];
    workItemId?: string;
  };

  const workItemId =
    toolName === "set_assignment_suggestions" && typeof parsed.workItemId === "string"
      ? parsed.workItemId
      : null;

  return parsed.suggestions.flatMap((suggestion) => {
    if (suggestion.suggestedText.trim().length === 0) {
      return [];
    }

    const originalText = getOriginalText(originalTexts, suggestion.section, suggestion.assignmentId);
    if (originalText !== null && suggestion.suggestedText.trim() === originalText.trim()) {
      return [];
    }

    // Always start as pending — the model must not pre-accept or pre-dismiss its own suggestions.
    const status: AIRevisionSuggestionStatus = "pending";
    const matchedWorkItemId =
      workItemId
      ?? currentWorkItems.find((item) => {
        if (item.status === "completed" || item.status === "no_changes_needed") {
          return false;
        }

        if (suggestion.assignmentId && item.assignment_id) {
          return item.assignment_id === suggestion.assignmentId;
        }

        return item.section.trim().toLowerCase() === suggestion.section.trim().toLowerCase();
      })?.work_item_id
      ?? null;
    const suggestionId = matchedWorkItemId ? `${matchedWorkItemId}:${suggestion.id}` : suggestion.id;
    return [{
      work_item_id: matchedWorkItemId,
      suggestion_id: suggestionId,
      summary: parsed.summary ?? null,
      title: suggestion.title,
      description: suggestion.description,
      section: suggestion.section,
      assignment_id: suggestion.assignmentId ?? null,
      suggested_text: suggestion.suggestedText,
      status,
      skills: suggestion.skills ?? null,
      skill_scope: suggestion.skillScope ?? null,
      payload: suggestion,
      resolved_at: resolvedAtForStatus(status),
    }];
  });
}

function mergeSuggestions(
  current: PersistedSuggestion[],
  incoming: PersistedSuggestion[],
): PersistedSuggestion[] {
  const next = [...current];

  for (const suggestion of incoming) {
    const existingIndex = next.findIndex((item) => item.suggestion_id === suggestion.suggestion_id);
    if (existingIndex < 0) {
      next.push(suggestion);
      continue;
    }

    const existing = next[existingIndex];
    if (!existing) {
      next.push(suggestion);
      continue;
    }

    next[existingIndex] = {
      ...suggestion,
      status:
        existing.status !== "pending" && suggestion.status === "pending"
          ? existing.status
          : suggestion.status,
      resolved_at:
        existing.status !== "pending" && suggestion.status === "pending"
          ? existing.resolved_at
          : suggestion.resolved_at,
    };
  }

  return next;
}

function toInsertableRows(
  conversationId: string,
  branchId: string,
  suggestions: PersistedSuggestion[],
): NewAIRevisionSuggestion[] {
  return suggestions.map((suggestion) => ({
    conversation_id: conversationId,
    branch_id: branchId,
    work_item_id: suggestion.work_item_id,
    suggestion_id: suggestion.suggestion_id,
    summary: suggestion.summary,
    title: suggestion.title,
    description: suggestion.description,
    section: suggestion.section,
    assignment_id: suggestion.assignment_id,
    suggested_text: suggestion.suggested_text,
    status: suggestion.status,
    skills: suggestion.skills,
    skill_scope: suggestion.skill_scope,
    payload: suggestion.payload,
    resolved_at: suggestion.resolved_at,
  }));
}

export function isPersistedRevisionSuggestionTool(
  toolName: string,
): toolName is SuggestionToolName {
  return toolName === "set_assignment_suggestions" || toolName === "set_revision_suggestions";
}

export async function listPersistedRevisionSuggestions(
  db: Kysely<Database>,
  conversationId: string,
) {
  return db
    .selectFrom("ai_revision_suggestions")
    .selectAll()
    .where("conversation_id", "=", conversationId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function persistRevisionToolCallSuggestions(
  db: Kysely<Database>,
  input: {
    conversationId: string;
    branchId: string;
    toolName: string;
    toolCallInput: unknown;
  },
): Promise<{ saved: boolean; incomingCount: number }> {
  if (!isPersistedRevisionSuggestionTool(input.toolName)) {
    return { saved: false, incomingCount: 0 };
  }

  const [currentSuggestions, currentWorkItems, originalTexts] = await Promise.all([
    listPersistedRevisionSuggestions(db, input.conversationId),
    listPersistedRevisionWorkItems(db, input.conversationId),
    fetchOriginalTexts(db, input.branchId),
  ]);
  const incoming = normalizeSuggestionRows(
    input.toolName,
    input.toolCallInput,
    currentWorkItems.map((item) => ({
      work_item_id: item.work_item_id,
      section: item.section,
      assignment_id: item.assignment_id,
      status: item.status,
    })),
    originalTexts,
  );
  const nextSuggestions = mergeSuggestions(
    currentSuggestions.map((suggestion) => ({
      work_item_id: suggestion.work_item_id,
      suggestion_id: suggestion.suggestion_id,
      summary: suggestion.summary,
      title: suggestion.title,
      description: suggestion.description,
      section: suggestion.section,
      assignment_id: suggestion.assignment_id,
      suggested_text: suggestion.suggested_text,
      status: suggestion.status,
      skills: suggestion.skills,
      skill_scope: suggestion.skill_scope,
      payload: suggestion.payload,
      resolved_at: suggestion.resolved_at,
    })),
    incoming,
  );

  await db
    .deleteFrom("ai_revision_suggestions")
    .where("conversation_id", "=", input.conversationId)
    .execute();

  if (nextSuggestions.length > 0) {
    await db
      .insertInto("ai_revision_suggestions")
      .values(toInsertableRows(input.conversationId, input.branchId, nextSuggestions))
      .execute();
  }

  return { saved: true, incomingCount: incoming.length };
}
