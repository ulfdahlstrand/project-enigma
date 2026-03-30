import type { z } from "zod";

export interface AIToolContext {
  route: string;
  entityType: string;
  entityId: string;
}

export interface AIToolResultMeta {
  toolName: string;
}

export interface AIToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: AIToolContext) => Promise<TOutput> | TOutput;
}

export interface AIToolCall {
  toolName: string;
  input: unknown;
}

export interface AIToolSuccess<TOutput = unknown> {
  ok: true;
  output: TOutput;
  meta: AIToolResultMeta;
}

export interface AIToolFailure {
  ok: false;
  error: string;
  meta: AIToolResultMeta;
}

export type AIToolExecutionResult<TOutput = unknown> = AIToolSuccess<TOutput> | AIToolFailure;

export interface AIToolRegistry {
  tools: AIToolDefinition<any, any>[];
}
