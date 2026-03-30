import { ZodError } from "zod";
import type {
  AIToolCall,
  AIToolContext,
  AIToolDefinition,
  AIToolExecutionResult,
  AIToolRegistry,
} from "./types";

function formatToolError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown tool error";
}

export function createAIToolRegistry(tools: AIToolDefinition<any, any>[]): AIToolRegistry {
  return { tools };
}

export function getAIToolDefinition(registry: AIToolRegistry, toolName: string): AIToolDefinition<any, any> | null {
  return registry.tools.find((tool) => tool.name === toolName) ?? null;
}

export async function executeAIToolCall(
  registry: AIToolRegistry,
  call: AIToolCall,
  context: AIToolContext,
): Promise<AIToolExecutionResult> {
  const tool = getAIToolDefinition(registry, call.toolName);

  if (!tool) {
    return {
      ok: false,
      error: `Unknown tool: ${call.toolName}`,
      meta: { toolName: call.toolName },
    };
  }

  try {
    const input = tool.inputSchema.parse(call.input);
    const output = await tool.execute(input, context);

    return {
      ok: true,
      output,
      meta: { toolName: tool.name },
    };
  } catch (error) {
    return {
      ok: false,
      error: formatToolError(error),
      meta: { toolName: tool.name },
    };
  }
}
