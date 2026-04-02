import {
  appendUniqueRevisionSuggestions,
} from "../../components/revision/inline-revision";
import {
  normalizeRevisionSuggestionsInput,
  type RevisionSuggestions,
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

export function deriveSuggestionsFromConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): RevisionSuggestions | null {
  let nextSuggestions: RevisionSuggestions | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const toolCall of extractPersistedToolCalls(message.content)) {
      if (toolCall.toolName === "set_revision_suggestions") {
        try {
          nextSuggestions = normalizeRevisionSuggestionsInput(toolCall.input as never);
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
          const normalizedSuggestions = normalizeRevisionSuggestionsInput({
            summary: input.summary,
            suggestions: input.suggestions,
          });

          nextSuggestions = appendUniqueRevisionSuggestions(nextSuggestions, {
            summary: normalizedSuggestions.summary,
            suggestions: normalizedSuggestions.suggestions.map((suggestion) => ({
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

  return nextSuggestions;
}
