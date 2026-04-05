import {
  markWorkItemsCompletedFromSuggestions,
  resolveRevisionWorkItems,
} from "../../components/revision/inline-revision";
import {
  revisionWorkItemsSchema,
  normalizeRevisionSuggestionsInput,
  type RevisionWorkItems,
} from "../../lib/ai-tools/registries/resume-tool-schemas";
import type { PersistedToolCall } from "./types";

function extractPersistedToolCalls(text: string): PersistedToolCall[] {
  return [...text.matchAll(/```json\s*([\s\S]*?)\s*```/g)].flatMap((match) => {
    const block = match[1];
    if (!block) {
      return [];
    }

    try {
      const parsed = JSON.parse(block.trim()) as PersistedToolCall;
      if (parsed.type === "tool_call" && typeof parsed.toolName === "string") {
        return [parsed];
      }
    } catch {
      return [];
    }

    return [];
  });
}

export function deriveWorkItemsFromConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): RevisionWorkItems | null {
  let nextWorkItems: RevisionWorkItems | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const toolCall of extractPersistedToolCalls(message.content)) {
      if (toolCall.toolName === "set_revision_work_items") {
        try {
          const incoming = revisionWorkItemsSchema.parse(toolCall.input);
          nextWorkItems = resolveRevisionWorkItems(nextWorkItems, incoming);
        } catch {
          continue;
        }
      }

      if (toolCall.toolName === "mark_revision_work_item_no_changes_needed") {
        try {
          const input = toolCall.input as { workItemId?: unknown; note?: unknown };
          if (!nextWorkItems || typeof input?.workItemId !== "string") {
            continue;
          }

          nextWorkItems = {
            ...nextWorkItems,
            items: nextWorkItems.items.map((item) =>
              item.id === input.workItemId
                ? {
                    ...item,
                    status: "no_changes_needed" as const,
                    ...(typeof input.note === "string" ? { note: input.note } : {}),
                  }
                : item,
            ),
          };
        } catch {
          continue;
        }
      }

      if (toolCall.toolName === "set_revision_suggestions") {
        try {
          const normalized = normalizeRevisionSuggestionsInput(toolCall.input as never);
          nextWorkItems = markWorkItemsCompletedFromSuggestions(nextWorkItems, normalized);
        } catch {
          continue;
        }
      }

      if (toolCall.toolName === "set_assignment_suggestions") {
        try {
          const input = toolCall.input as {
            workItemId: string;
            summary?: string;
            suggestions: unknown[];
          };
          const normalized = normalizeRevisionSuggestionsInput({
            summary: input.summary,
            suggestions: input.suggestions,
          });

          nextWorkItems = markWorkItemsCompletedFromSuggestions(nextWorkItems, {
            summary: normalized.summary,
            suggestions: normalized.suggestions.map((suggestion) => ({
              ...suggestion,
              id: `${input.workItemId}:${suggestion.id}`,
            })),
          });
        } catch {
          continue;
        }
      }
    }
  }

  return nextWorkItems;
}
