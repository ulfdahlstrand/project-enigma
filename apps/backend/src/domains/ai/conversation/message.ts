import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../lib/openai-client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import {
  generateConversationTitle,
  MIN_USER_MESSAGES_FOR_TITLE,
} from "../lib/generate-title.js";
import { logger } from "../../../infra/logger.js";
import {
  extractToolCalls,
  buildToolResultMessage,
} from "./tool-parsing.js";
import {
  BACKEND_INSPECT_TOOLS,
  executeBackendInspectTool,
} from "./tool-execution.js";

const MODEL = "gpt-4o";
const MAX_TOKENS = 2048;
// Limit history sent to OpenAI to avoid exceeding context window
const MAX_HISTORY_MESSAGES = 20;
// Maximum number of backend tool-call iterations per sendAIMessage invocation
const MAX_BACKEND_TOOL_LOOPS = 8;

export async function sendAIMessage(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  input: { conversationId: string; userMessage: string }
) {
  logger.info("AI message received", {
    conversationId: input.conversationId,
    userMessageLength: input.userMessage.length,
    userMessagePreview: input.userMessage.slice(0, 180),
  });

  const conversation = await db
    .selectFrom("ai_conversations")
    .selectAll()
    .where("id", "=", input.conversationId)
    .executeTakeFirst();

  if (!conversation) {
    throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
  }

  const existingMessages = await db
    .selectFrom("ai_messages")
    .selectAll()
    .where("conversation_id", "=", input.conversationId)
    .orderBy("created_at", "asc")
    .execute();

  logger.debug("AI conversation history loaded", {
    conversationId: input.conversationId,
    historyCount: existingMessages.length,
  });

  // Persist the user message first
  await db
    .insertInto("ai_messages")
    .values({
      conversation_id: input.conversationId,
      role: "user",
      content: input.userMessage,
    })
    .execute();

  // Build message history for OpenAI (capped to avoid token limit issues)
  const history = existingMessages.slice(-MAX_HISTORY_MESSAGES);
  const openAIMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: conversation.system_prompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  // ---------------------------------------------------------------------------
  // Tool-call loop
  //
  // For resume-revision-actions conversations, inspect tool calls are executed
  // on the backend without a round-trip to the browser. The loop runs until:
  //   - the assistant returns a message with no tool call, OR
  //   - the tool call is not a backend inspect tool (handed off to frontend), OR
  //   - MAX_BACKEND_TOOL_LOOPS iterations are reached.
  // ---------------------------------------------------------------------------

  // Shared helper to call OpenAI and throw on empty response
  async function callOpenAI(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string> {
    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "AI returned empty response",
      });
    }
    return content;
  }

  let assistantContent = await callOpenAI(openAIMessages);

  // Persist initial assistant message
  let assistantRow = await db
    .insertInto("ai_messages")
    .values({
      conversation_id: input.conversationId,
      role: "assistant",
      content: assistantContent,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Backend tool-call loop (only for resume-revision-actions in Phase 1)
  if (conversation.entity_type === "resume-revision-actions") {
    for (let i = 0; i < MAX_BACKEND_TOOL_LOOPS; i++) {
      const toolCalls = extractToolCalls(assistantContent);
      if (toolCalls.length === 0) break;

      const toolCall = toolCalls[0]!;
      if (!BACKEND_INSPECT_TOOLS.has(toolCall.toolName)) break;

      logger.debug("Backend tool-call loop iteration", {
        conversationId: input.conversationId,
        iteration: i,
        toolName: toolCall.toolName,
      });

      const toolResult = await executeBackendInspectTool(
        db,
        conversation.entity_type,
        conversation.entity_id,
        toolCall,
      );

      const toolResultContent = buildToolResultMessage(toolCall.toolName, toolResult);

      // Persist the tool result as a user message (internal, not user-visible)
      await db
        .insertInto("ai_messages")
        .values({
          conversation_id: input.conversationId,
          role: "user",
          content: toolResultContent,
        })
        .execute();

      // Reload full history for next OpenAI call
      const updatedHistory = await db
        .selectFrom("ai_messages")
        .selectAll()
        .where("conversation_id", "=", input.conversationId)
        .orderBy("created_at", "asc")
        .execute();

      const nextMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: conversation.system_prompt },
        ...updatedHistory.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      assistantContent = await callOpenAI(nextMessages);

      assistantRow = await db
        .insertInto("ai_messages")
        .values({
          conversation_id: input.conversationId,
          role: "assistant",
          content: assistantContent,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  logger.info("AI message responded", {
    conversationId: input.conversationId,
    assistantMessageId: assistantRow.id,
    assistantMessageLength: assistantContent.length,
    assistantMessagePreview: assistantContent.slice(0, 180),
  });

  // Generate a title after the 2nd user message if none exists yet (fire-and-forget)
  const userMessageCount = existingMessages.filter((m) => m.role === "user").length + 1;
  if (userMessageCount >= MIN_USER_MESSAGES_FOR_TITLE && conversation.title === null) {
    const allMessages = [
      ...existingMessages,
      { role: "user", content: input.userMessage },
      { role: "assistant", content: assistantContent },
    ];
    void generateConversationTitle(openaiClient, allMessages).then((title) => {
      if (title) {
        logger.debug("AI conversation title generated", {
          conversationId: input.conversationId,
          title,
        });
        void db
          .updateTable("ai_conversations")
          .set({ updated_at: new Date(), title })
          .where("id", "=", input.conversationId)
          .execute();
      }
    });
  }

  // Update conversation updated_at
  await db
    .updateTable("ai_conversations")
    .set({ updated_at: new Date() })
    .where("id", "=", input.conversationId)
    .execute();

  return {
    id: assistantRow.id,
    conversationId: assistantRow.conversation_id,
    role: assistantRow.role as "assistant",
    content: assistantRow.content,
    createdAt: assistantRow.created_at.toISOString(),
  };
}

export const sendAIMessageHandler = implement(contract.sendAIMessage).handler(
  async ({ input, context }) => {
    requireAuth(context as AuthContext);
    return sendAIMessage(getDb(), getOpenAIClient(), input);
  }
);

export function createSendAIMessageHandler(db: Kysely<Database>, openaiClient: OpenAI) {
  return implement(contract.sendAIMessage).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return sendAIMessage(db, openaiClient, input);
    }
  );
}
