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
  INTERNAL_AUTOSTART_PREFIX,
  INTERNAL_GUARDRAIL_PREFIX,
} from "./tool-parsing.js";
import {
  BACKEND_INSPECT_TOOLS,
  executeBackendInspectTool,
} from "./tool-execution.js";
import {
  deriveNextActionOrchestrationMessage,
  deriveNextActionOrchestrationMessageFromWorkItems,
  deriveNextPlanningOrchestrationMessage,
} from "./action-orchestration.js";
import { insertAIDelivery } from "./deliveries.js";
import {
  buildLegacyAssistantToolCallContent,
  buildRevisionOpenAITools,
  parseRevisionToolArguments,
} from "./revision-tools.js";
import { persistRevisionToolCallWorkItems } from "./revision-work-items.js";
import { listPersistedRevisionWorkItems } from "./revision-work-items.js";

const MODEL = "gpt-4o";
const MAX_TOKENS = 2048;
// Limit history sent to OpenAI to avoid exceeding context window
const MAX_HISTORY_MESSAGES = 20;
// Maximum number of backend tool-call iterations per sendAIMessage invocation
const MAX_BACKEND_TOOL_LOOPS = 8;
const REVISION_TOOL_GUARDRAIL_MESSAGE = [
  "You must use the available tools for this revision request.",
  "Inspect the exact source text you need and then emit concrete revision suggestions.",
  "Do not continue with free-text status updates.",
  "Return a tool call now.",
].join(" ");

function detectConversationLanguage(systemPrompt: string) {
  return systemPrompt.toLowerCase().includes("swedish") ? "sv" : "en";
}

function buildHelpMessage(entityType: string, language: "sv" | "en") {
  if (entityType === "resume-revision-actions") {
    if (language === "sv") {
      return [
        "Här är vad du kan be mig om i den här revisionschatten:",
        "",
        "- Rätta stavfel eller grammatik i presentationen, sammanfattningen, titeln eller konsulttiteln.",
        "- Rätta eller förbättra ett specifikt uppdrag, till exempel `fixa payer-uppdraget`.",
        "- Gå igenom flera uppdrag eller hela CV:t, till exempel `fixa stavfel i alla uppdrag`.",
        "- Förbättra formuleringar utan att ändra innehållets innebörd.",
        "- Hjälpa dig med kompetenser, till exempel ordning, gruppering eller stavning när det är relevant.",
        "- Berätta vad som återstår att göra, till exempel `har vi något kvar?` eller `visa ej utfört arbete`.",
        "- Förklara vad som redan föreslagits eller vad som är blockerat i den här branchen.",
        "",
        "Tips på kommandon:",
        "- `/help` visar den här hjälpen igen.",
        "- `vad återstår?` visar nuvarande work items och deras status.",
        "- `fixa stavfel i presentationen` skapar konkreta förslag när något behöver ändras.",
      ].join("\n");
    }

    return [
      "Here is what you can ask me to do in this revision chat:",
      "",
      "- Fix spelling or grammar in the presentation, summary, title, or consultant title.",
      "- Fix or improve one specific assignment, for example `fix the Payer assignment`.",
      "- Review several assignments or the whole resume, for example `fix spelling in all assignments`.",
      "- Improve wording while keeping the original meaning.",
      "- Help with skills, such as ordering, grouping, or spelling when relevant.",
      "- Tell you what work remains, for example `what is left?` or `show unfinished work`.",
      "- Explain what has already been proposed or what is blocked in this branch.",
      "",
      "Useful commands:",
      "- `/help` shows this help again.",
      "- `what is left?` shows the current work items and their statuses.",
      "- `fix spelling in the presentation` creates concrete suggestions when changes are needed.",
    ].join("\n");
  }

  if (language === "sv") {
    return [
      "Här är vad du kan använda chatten till:",
      "",
      "- Be om hjälp att granska och förbättra texten i den aktuella kontexten.",
      "- Be om konkreta ändringsförslag.",
      "- Fråga vad som redan föreslagits eller vad nästa steg är.",
      "",
      "Tips:",
      "- `/help` visar den här hjälpen igen.",
    ].join("\n");
  }

  return [
    "Here is what you can use this chat for:",
    "",
    "- Ask for help reviewing and improving the current text.",
    "- Ask for concrete revision suggestions.",
    "- Ask what has already been proposed or what the next step is.",
    "",
    "Tip:",
    "- `/help` shows this help again.",
  ].join("\n");
}

async function buildStatusMessage(
  db: Kysely<Database>,
  input: { conversationId: string; entityType: string; language: "sv" | "en" },
) {
  if (input.entityType !== "resume-revision-actions") {
    return input.language === "sv"
      ? "Ingen särskild arbetsstatus finns för den här chatten."
      : "There is no special work status for this chat.";
  }

  const workItems = await listPersistedRevisionWorkItems(db, input.conversationId);
  if (workItems.length === 0) {
    return input.language === "sv"
      ? "Det finns inga registrerade work items i den här revisionschatten ännu."
      : "There are no recorded work items in this revision chat yet.";
  }

  const counts = {
    pending: workItems.filter((item) => item.status === "pending").length,
    inProgress: workItems.filter((item) => item.status === "in_progress").length,
    completed: workItems.filter((item) => item.status === "completed").length,
    noChangesNeeded: workItems.filter((item) => item.status === "no_changes_needed").length,
    blocked: workItems.filter((item) => item.status === "blocked").length,
    failed: workItems.filter((item) => item.status === "failed").length,
  };
  const nextItem = workItems.find((item) =>
    item.status === "pending" || item.status === "in_progress" || item.status === "blocked" || item.status === "failed"
  );

  if (input.language === "sv") {
    return [
      "## Status",
      "",
      `Totalt: **${workItems.length}** work item(s)`,
      "",
      "- Pending: **" + counts.pending + "**",
      "- In progress: **" + counts.inProgress + "**",
      "- Klara: **" + counts.completed + "**",
      "- Inga ändringar behövs: **" + counts.noChangesNeeded + "**",
      "- Blockerade: **" + counts.blocked + "**",
      "- Misslyckade: **" + counts.failed + "**",
      "",
      "## Nästa steg",
      "",
      nextItem
        ? `- **${nextItem.title}** (${nextItem.status})`
        : "Det finns inget kvar att göra i arbetslistan just nu.",
    ].join("\n");
  }

  return [
    "## Status",
    "",
    `Total: **${workItems.length}** work item(s)`,
    "",
    "- Pending: **" + counts.pending + "**",
    "- In progress: **" + counts.inProgress + "**",
    "- Completed: **" + counts.completed + "**",
    "- No changes needed: **" + counts.noChangesNeeded + "**",
    "- Blocked: **" + counts.blocked + "**",
    "- Failed: **" + counts.failed + "**",
    "",
    "## Next Step",
    "",
    nextItem
      ? `- **${nextItem.title}** (${nextItem.status})`
      : "There is no remaining work in the queue right now.",
  ].join("\n");
}

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
  if (trimmedUserMessage === "/help" || trimmedUserMessage === "/status") {
    const language = detectConversationLanguage(conversation.system_prompt);
    const content = trimmedUserMessage === "/help"
      ? buildHelpMessage(conversation.entity_type, language)
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
    };
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
  const revisionTools = isRevisionConversation ? buildRevisionOpenAITools() : undefined;
  let assistantMessage = await callOpenAI(openAIMessages, revisionTools);
  let assistantContent = assistantMessage.content ?? "";
  let assistantRow: {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    created_at: Date;
  } | null = null;

  async function persistAssistantMessage(content: string) {
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

  if (!isRevisionConversation || !assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
    assistantRow = await persistAssistantMessage(assistantContent);
  }

  // Backend tool-call loop with lightweight action orchestration for
  // resume-revision-actions conversations.
  if (
    conversation.entity_type === "resume-revision-actions"
    || conversation.entity_type === "resume-revision-planning"
  ) {
    for (let i = 0; i < MAX_BACKEND_TOOL_LOOPS; i++) {
      const revisionToolCalls = isRevisionConversation
        ? (assistantMessage.tool_calls ?? []).map((toolCall: any) => ({
            // OpenAI SDK narrows this poorly across tool variants; the revision
            // path only sends function tools.
            id: toolCall.id,
            toolName: toolCall.function.name,
            input: parseRevisionToolArguments(
              toolCall.function.name,
              toolCall.function.arguments ?? "{}",
            ),
          }))
        : [];
      const legacyToolCalls = !isRevisionConversation ? extractToolCalls(assistantContent) : [];

      if (isRevisionConversation && revisionToolCalls.length > 0) {
        const persistedToolCalls: Array<{ toolName: string; input?: unknown }> = [];
        const frontendToolCalls: Array<{ toolName: string; input?: unknown }> = [];

        for (const toolCall of revisionToolCalls) {
          await insertAIDelivery(db, {
            conversationId: input.conversationId,
            kind: "tool_call",
            role: "assistant",
            toolName: toolCall.toolName,
            payload: {
              id: toolCall.id,
              input: toolCall.input,
            },
          });

          if (BACKEND_INSPECT_TOOLS.has(toolCall.toolName)) {
          const toolResult = await executeBackendInspectTool(
            db,
            conversation.entity_type,
            conversation.entity_id,
            {
              type: "tool_call",
              toolName: toolCall.toolName,
              input: toolCall.input,
            },
            { conversationId: input.conversationId },
          );

            await insertAIDelivery(db, {
              conversationId: input.conversationId,
              kind: "tool_result",
              role: "tool",
              toolName: toolCall.toolName,
              payload: toolResult,
              content: toolResult.ok ? JSON.stringify(toolResult.output ?? null) : toolResult.error ?? null,
            });

            openAIMessages.push({
              role: "assistant",
              content: assistantMessage.content ?? "",
              tool_calls: [{
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.toolName,
                  arguments: JSON.stringify(toolCall.input ?? {}),
                },
              }],
            });
            openAIMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(
                toolResult.ok
                  ? { ok: true, output: toolResult.output }
                  : { ok: false, error: toolResult.error ?? "Tool execution failed" },
              ),
            });
            continue;
          }

          const persisted = await persistRevisionToolCallWorkItems(db, {
            conversationId: input.conversationId,
            branchId: conversation.entity_id,
            toolName: toolCall.toolName,
            toolCallInput: toolCall.input,
          });

          if (!persisted) {
            frontendToolCalls.push({
              toolName: toolCall.toolName,
              input: toolCall.input,
            });
            continue;
          }

          persistedToolCalls.push({
            toolName: toolCall.toolName,
            input: toolCall.input,
          });

          const toolResult = { ok: true, output: { persisted: true } };
          await insertAIDelivery(db, {
            conversationId: input.conversationId,
            kind: "tool_result",
            role: "tool",
            toolName: toolCall.toolName,
            payload: toolResult,
            content: JSON.stringify(toolResult.output),
          });

          openAIMessages.push({
            role: "assistant",
            content: assistantMessage.content ?? "",
            tool_calls: [{
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.toolName,
                arguments: JSON.stringify(toolCall.input ?? {}),
              },
            }],
          });
          openAIMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: true, output: toolResult.output }),
          });
        }

        if (persistedToolCalls.length > 0) {
          const persistedContent = buildLegacyAssistantToolCallContent(persistedToolCalls);
          assistantRow = await persistAssistantMessage(persistedContent);
        }

        if (frontendToolCalls.length > 0) {
          assistantContent = buildLegacyAssistantToolCallContent(frontendToolCalls);
          assistantRow = await persistAssistantMessage(assistantContent);
          break;
        }

        assistantMessage = await callOpenAI(openAIMessages, revisionTools);
        assistantContent = assistantMessage.content ?? "";
        continue;
      }

      const toolCalls = legacyToolCalls;
      if (toolCalls.length === 0) {
        if (isRevisionConversation && i === 0) {
          const guardrailContent = `${INTERNAL_GUARDRAIL_PREFIX} ${REVISION_TOOL_GUARDRAIL_MESSAGE}`;
          await insertAIDelivery(db, {
            conversationId: input.conversationId,
            kind: "internal_message",
            role: "user",
            content: guardrailContent,
          });
          openAIMessages.push({ role: "user", content: guardrailContent });
          assistantMessage = await callOpenAI(openAIMessages, revisionTools);
          assistantContent = assistantMessage.content ?? "";
          continue;
        }

        if (!assistantRow || assistantRow.content !== assistantContent) {
          assistantRow = await persistAssistantMessage(assistantContent);
        }

        const updatedHistory = await db
          .selectFrom("ai_messages")
          .selectAll()
          .where("conversation_id", "=", input.conversationId)
          .orderBy("created_at", "asc")
          .execute();

        const orchestrationHistory = updatedHistory.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));
        let orchestrationMessage;
        if (conversation.entity_type === "resume-revision-actions") {
          const persistedWorkItems = await listPersistedRevisionWorkItems(db, input.conversationId);
          const persistedAutomation = deriveNextActionOrchestrationMessageFromWorkItems(
            persistedWorkItems.map((item) => ({
              id: item.work_item_id,
              title: item.title,
              description: item.description,
              section: item.section,
              ...(item.assignment_id ? { assignmentId: item.assignment_id } : {}),
              status: item.status,
              ...(item.note ? { note: item.note } : {}),
            })),
          );

          orchestrationMessage = persistedAutomation
            ? { kind: "automation" as const, content: `${INTERNAL_AUTOSTART_PREFIX} ${persistedAutomation}` }
            : deriveNextActionOrchestrationMessage(orchestrationHistory);
        } else {
          orchestrationMessage = deriveNextPlanningOrchestrationMessage(orchestrationHistory);
        }

        if (!orchestrationMessage) {
          break;
        }

        await db
          .insertInto("ai_message_deliveries")
          .values({
            conversation_id: input.conversationId,
            ai_message_id: null,
            kind: "internal_message",
            role: "user",
            content: orchestrationMessage.content,
            tool_name: null,
            payload: null,
          })
          .execute();

        const nextMessages: Array<any> = [
          { role: "system", content: conversation.system_prompt },
          ...updatedHistory
            .concat({
              id: "internal-orchestration",
              conversation_id: input.conversationId,
              role: "user",
              content: orchestrationMessage.content,
              created_at: new Date(),
            })
            .slice(-MAX_HISTORY_MESSAGES)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        ];

        assistantMessage = await callOpenAI(nextMessages, revisionTools);
        assistantContent = assistantMessage.content ?? "";
        assistantRow = await persistAssistantMessage(assistantContent);

        continue;
      }

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
        { conversationId: input.conversationId },
      );

      const toolResultContent = buildToolResultMessage(toolCall.toolName, toolResult);

      await insertAIDelivery(db, {
        conversationId: input.conversationId,
        kind: "tool_call",
        role: "assistant",
        toolName: toolCall.toolName,
        payload: toolCall.input,
      });
      await insertAIDelivery(db, {
        conversationId: input.conversationId,
        kind: "tool_result",
        role: "user",
        toolName: toolCall.toolName,
        payload: toolResult,
        content: toolResultContent,
      });

      // Reload full history for next OpenAI call
      const updatedHistory = await db
        .selectFrom("ai_messages")
        .selectAll()
        .where("conversation_id", "=", input.conversationId)
        .orderBy("created_at", "asc")
        .execute();

      const nextMessages: Array<any> = [
        { role: "system", content: conversation.system_prompt },
        ...updatedHistory.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "assistant", content: assistantContent },
        { role: "user", content: toolResultContent },
      ];

      assistantMessage = await callOpenAI(nextMessages);
      assistantContent = assistantMessage.content ?? "";
      assistantRow = await persistAssistantMessage(assistantContent);
    }
  }

  if (!assistantRow) {
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
