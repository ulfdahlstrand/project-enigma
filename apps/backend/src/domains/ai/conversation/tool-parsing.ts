// ---------------------------------------------------------------------------
// Tool-call parsing utilities — backend port
//
// Ported from the frontend ai-message-parsing module. These are pure functions
// with no dependency on React or the browser.
// ---------------------------------------------------------------------------

export interface ToolCallPayload {
  type: "tool_call";
  toolName: string;
  input?: unknown;
}

export interface ToolResultPayload {
  type: "tool_result";
  toolName: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

const MAX_TOOL_RESULT_MESSAGE_LENGTH = 9000;
const MAX_TOOL_STRING_LENGTH = 500;
const MAX_TOOL_ARRAY_ITEMS = 12;
const MAX_TOOL_OBJECT_KEYS = 20;

export function extractJsonBlocks(text: string): unknown[] {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  return matches.flatMap((match) => {
    const block = match[1];
    if (!block) return [];
    try {
      return [JSON.parse(block.trim()) as unknown];
    } catch {
      return [];
    }
  });
}

export function extractToolCalls(text: string): ToolCallPayload[] {
  return extractJsonBlocks(text).flatMap((parsed) => {
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ToolCallPayload).type === "tool_call" &&
      typeof (parsed as ToolCallPayload).toolName === "string"
    ) {
      return [parsed as ToolCallPayload];
    }
    return [];
  });
}

function compactToolValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length <= MAX_TOOL_STRING_LENGTH
      ? value
      : `${value.slice(0, MAX_TOOL_STRING_LENGTH)}…`;
  }
  if (Array.isArray(value)) {
    const compacted = value
      .slice(0, MAX_TOOL_ARRAY_ITEMS)
      .map((item) => compactToolValue(item, depth + 1));
    if (value.length > MAX_TOOL_ARRAY_ITEMS) {
      compacted.push(`[${value.length - MAX_TOOL_ARRAY_ITEMS} more items]`);
    }
    return compacted;
  }
  if (value && typeof value === "object") {
    if (depth >= 4) return "[truncated object]";
    const entries = Object.entries(value).slice(0, MAX_TOOL_OBJECT_KEYS);
    const compacted = entries.map(([k, v]) => [k, compactToolValue(v, depth + 1)]);
    if (Object.keys(value).length > MAX_TOOL_OBJECT_KEYS) {
      compacted.push(["_truncated", true]);
    }
    return Object.fromEntries(compacted);
  }
  return value;
}

export function buildToolResultMessage(
  toolName: string,
  result: { ok: boolean; output?: unknown; error?: string },
): string {
  const basePayload: ToolResultPayload = {
    type: "tool_result",
    toolName,
    ok: result.ok,
    ...(result.ok ? { output: result.output } : { error: result.error ?? "Tool execution failed" }),
  };

  let payload = basePayload;
  let serialized = JSON.stringify(payload);

  if (serialized.length > MAX_TOOL_RESULT_MESSAGE_LENGTH) {
    payload = {
      ...basePayload,
      ...(result.ok ? { output: compactToolValue(result.output) } : {}),
    };
    serialized = JSON.stringify(payload);
  }

  if (serialized.length > MAX_TOOL_RESULT_MESSAGE_LENGTH) {
    payload = {
      ...basePayload,
      ...(result.ok
        ? { output: "[tool result truncated]" }
        : {
            error:
              typeof result.error === "string"
                ? result.error.slice(0, 300)
                : "Tool execution failed",
          }),
    };
    serialized = JSON.stringify(payload);
  }

  return [
    "Tool execution result:",
    "```json",
    serialized,
    "```",
    "Continue the conversation using this result. Do not ask the user to execute the tool manually.",
  ].join("\n");
}
