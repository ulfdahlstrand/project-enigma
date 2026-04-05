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
  INTERNAL_AUTOSTART_PREFIX,
  INTERNAL_GUARDRAIL_PREFIX,
} from "./tool-parsing.js";
import { insertAIDelivery } from "./deliveries.js";
import { buildRevisionOpenAITools } from "./revision-tools.js";
import {
  runRevisionWorkflow,
  detectConversationLanguage,
  buildHelpMessage,
  buildExplainMessage,
  buildStatusMessage,
  requiresExplicitAssignmentWorkQueue,
  isWaitingForRevisionScopeDecision,
} from "./revision-workflow-engine.js";
import { classifyDecision, setPendingDecision } from "./pending-decision.js";

export { requiresExplicitAssignmentWorkQueue, isWaitingForRevisionScopeDecision };

const MODEL = "gpt-4o";
const MAX_TOKENS = 2048;
// Limit history sent to OpenAI to avoid exceeding context window
const MAX_HISTORY_MESSAGES = 20;

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

  if (conversation.is_closed) {
    throw new ORPCError("FAILED_PRECONDITION", {
      message: "Conversation is closed",
    });
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

  const isInternalUserMessage =
    input.userMessage.startsWith(INTERNAL_AUTOSTART_PREFIX)
    || input.userMessage.startsWith(INTERNAL_GUARDRAIL_PREFIX);

  if (isInternalUserMessage) {
    await insertAIDelivery(db, {
      conversationId: input.conversationId,
      kind: "internal_message",
      role: "user",
      content: input.userMessage,
    });
  } else {
    const userRow = await db
      .insertInto("ai_messages")
      .values({
        conversation_id: input.conversationId,
        role: "user",
        content: input.userMessage,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await insertAIDelivery(db, {
      conversationId: input.conversationId,
      aiMessageId: userRow.id,
      kind: "visible_message",
      role: "user",
      content: input.userMessage,
    });
  }

  const trimmedUserMessage = input.userMessage.trim();
  if (trimmedUserMessage === "/help" || trimmedUserMessage === "/status" || trimmedUserMessage === "/explain") {
    const language = detectConversationLanguage(conversation.system_prompt);
    const content = trimmedUserMessage === "/help"
      ? buildHelpMessage(conversation.entity_type, language)
      : trimmedUserMessage === "/explain"
        ? await buildExplainMessage(db, {
            conversationId: input.conversationId,
            entityType: conversation.entity_type,
            language,
          })
      : await buildStatusMessage(db, {
          conversationId: input.conversationId,
          entityType: conversation.entity_type,
          language,
        });

    const assistantHelpRow = await db
      .insertInto("ai_messages")
      .values({
        conversation_id: input.conversationId,
        role: "assistant",
        content,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await insertAIDelivery(db, {
      conversationId: input.conversationId,
      aiMessageId: assistantHelpRow.id,
      kind: "visible_message",
      role: "assistant",
      content,
    });

    await db
      .updateTable("ai_conversations")
      .set({ updated_at: new Date() })
      .where("id", "=", input.conversationId)
      .execute();

    return {
      id: assistantHelpRow.id,
      conversationId: assistantHelpRow.conversation_id,
      role: assistantHelpRow.role as "assistant",
      content: assistantHelpRow.content,
      createdAt: assistantHelpRow.created_at.toISOString(),
      needsContinuation: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Pending decision gate
  //
  // When the conversation has a pending_decision, the model asked a blocking
  // yes/no question. Classify the user's reply with a cheap model call before
  // running the main workflow. If the answer is unclear, reply immediately and
  // keep the lock in place so the user can try again.
  // ---------------------------------------------------------------------------

  let pendingDecisionAnswer: "yes" | "no" | null = null;

  if (conversation.pending_decision && !isInternalUserMessage) {
    const answer = await classifyDecision(openaiClient, input.userMessage);
    const language = detectConversationLanguage(conversation.system_prompt);

    if (answer === "unclear") {
      const clarificationContent = language === "sv"
        ? "Jag förstod inte riktigt — vänligen svara ja eller nej."
        : "I didn't quite catch that — please answer yes or no.";

      const clarificationRow = await db
        .insertInto("ai_messages")
        .values({
          conversation_id: input.conversationId,
          role: "assistant",
          content: clarificationContent,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await insertAIDelivery(db, {
        conversationId: input.conversationId,
        aiMessageId: clarificationRow.id,
        kind: "visible_message",
        role: "assistant",
        content: clarificationContent,
      });

      await db
        .updateTable("ai_conversations")
        .set({ updated_at: new Date() })
        .where("id", "=", input.conversationId)
        .execute();

      return {
        id: clarificationRow.id,
        conversationId: clarificationRow.conversation_id,
        role: clarificationRow.role as "assistant",
        content: clarificationRow.content,
        createdAt: clarificationRow.created_at.toISOString(),
        needsContinuation: false,
      };
    }

    // Clear the lock — a definitive yes/no was given.
    await setPendingDecision(db, input.conversationId, null);
    pendingDecisionAnswer = answer;
  }

  // Build message history for OpenAI (capped to avoid token limit issues)
  const history = existingMessages.slice(-MAX_HISTORY_MESSAGES);
  const openAIMessages: Array<any> = [
    { role: "system", content: conversation.system_prompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  // Shared helper to call OpenAI and throw on empty response
  async function callOpenAI(
    messages: Array<any>,
    tools?: Array<Record<string, unknown>>,
  ): Promise<any> {
    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
      ...(tools ? { tools } : {}),
    } as any);
    const message = response.choices[0]?.message;
    if (!message || ((!message.content || message.content.length === 0) && (!message.tool_calls || message.tool_calls.length === 0))) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "AI returned empty response",
      });
    }
    return message;
  }

  const isRevisionConversation = conversation.entity_type === "resume-revision-actions";
  const isRevisionOrPlanningConversation =
    conversation.entity_type === "resume-revision-actions"
    || conversation.entity_type === "resume-revision-planning";

  const revisionTools = isRevisionConversation ? buildRevisionOpenAITools() : undefined;
  let assistantMessage = await callOpenAI(openAIMessages, revisionTools);
  let assistantContent = assistantMessage.content ?? "";

  async function persistAssistantMessage(content: string) {
    if (content.trim().length === 0) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "AI returned an empty assistant message during the revision workflow.",
      });
    }

    const row = await db
      .insertInto("ai_messages")
      .values({
        conversation_id: input.conversationId,
        role: "assistant",
        content,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await insertAIDelivery(db, {
      conversationId: input.conversationId,
      aiMessageId: row.id,
      kind: "visible_message",
      role: "assistant",
      content,
    });

    return row;
  }

  let assistantRow: {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    created_at: Date;
  };
  let needsContinuation = false;

  if (isRevisionOrPlanningConversation) {
    // For revision conversations that return tool calls on the first response, the engine
    // handles persisting all messages. Otherwise, persist the initial response now and
    // pass it to the engine as a starting point.
    const hasInitialToolCalls =
      isRevisionConversation
      && assistantMessage.tool_calls
      && assistantMessage.tool_calls.length > 0;
    const initialAssistantRow = hasInitialToolCalls
      ? null
      : await persistAssistantMessage(assistantContent);

    const result = await runRevisionWorkflow(db, {
      conversationId: input.conversationId,
      conversation,
      userMessage: input.userMessage,
      existingMessages,
      openAIMessages,
      firstAssistantMessage: assistantMessage,
      initialAssistantRow,
      callOpenAI,
      persistAssistantMessage,
      maxHistoryMessages: MAX_HISTORY_MESSAGES,
      pendingDecisionAnswer,
    });
    assistantRow = result.assistantRow;
    needsContinuation = result.needsContinuation;
    assistantContent = assistantRow.content;
  } else {
    assistantRow = await persistAssistantMessage(assistantContent);
  }

  logger.info("AI message responded", {
    conversationId: input.conversationId,
    assistantMessageId: assistantRow.id,
    assistantMessageLength: assistantContent.length,
    assistantMessagePreview: assistantContent.slice(0, 180),
  });

  // Generate a title after the 2nd user message if none exists yet (fire-and-forget)
  const userMessageCount = existingMessages.filter((m) => m.role === "user").length + (isInternalUserMessage ? 0 : 1);
  if (userMessageCount >= MIN_USER_MESSAGES_FOR_TITLE && conversation.title === null && !isInternalUserMessage) {
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
    needsContinuation,
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
