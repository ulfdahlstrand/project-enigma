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
import {
  listPersistedRevisionSuggestions,
  persistRevisionToolCallSuggestions,
} from "./revision-suggestions.js";
import { forkResumeBranch } from "../../resume/branch/fork.js";

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

function isWaitingForRevisionScopeDecision(content: string) {
  const normalized = content.trim().toLowerCase();
  if (!normalized.endsWith("?")) {
    return false;
  }

  const asksAboutMoreChanges =
    normalized.includes("fler ändringar")
    || normalized.includes("något mer")
    || normalized.includes("något annat")
    || normalized.includes("more changes")
    || normalized.includes("anything else")
    || normalized.includes("what else");

  const asksAboutCurrentScope =
    normalized.includes("bara presentationen")
    || normalized.includes("den enda ändringen")
    || normalized.includes("just nu")
    || normalized.includes("only the presentation")
    || normalized.includes("only change")
    || normalized.includes("after that");

  const asksAboutBranchCreation =
    normalized.includes("skapa den nu")
    || normalized.includes("skapa en ny branch")
    || normalized.includes("skapa en ny gren")
    || normalized.includes("ska vi skapa")
    || normalized.includes("vill du att vi skapar")
    || normalized.includes("create it now")
    || normalized.includes("create a new branch")
    || normalized.includes("should we create");

  return asksAboutMoreChanges || asksAboutCurrentScope || asksAboutBranchCreation;
}

function isExplicitBranchCreationConfirmation(message: string) {
  const normalized = message.trim().toLowerCase();

  return normalized === "ja"
    || normalized === "ja tack"
    || normalized === "ja, tack"
    || normalized === "ja gör det"
    || normalized === "ja, gör det"
    || normalized === "gör det"
    || normalized === "skapa den"
    || normalized === "skapa den nu"
    || normalized === "skapa en ny branch"
    || normalized === "skapa en ny gren"
    || normalized === "yes"
    || normalized === "yes please"
    || normalized === "do it"
    || normalized === "create it"
    || normalized === "create the branch";
}

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
        "- `/explain` förklarar varför förslag skapats och vad som redan har granskats.",
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
      "- `/explain` explains why suggestions were created and what has already been inspected.",
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

function describeInspectedTarget(
  toolName: string | null,
  payload: unknown,
  language: "sv" | "en",
) {
  const input =
    payload && typeof payload === "object" && "input" in payload
      ? (payload as { input?: unknown }).input
      : null;

  if (toolName === "inspect_resume") {
    return language === "sv" ? "Översikt av hela CV:t" : "Whole resume overview";
  }

  if (toolName === "inspect_resume_sections") {
    const includeAssignments =
      input && typeof input === "object" && input !== null && "includeAssignments" in input
        ? Boolean((input as { includeAssignments?: unknown }).includeAssignments)
        : false;
    return includeAssignments
      ? (language === "sv"
          ? "Alla redigerbara sektioner inklusive uppdrag"
          : "All editable sections including assignments")
      : (language === "sv"
          ? "Alla redigerbara sektioner"
          : "All editable sections");
  }

  if (toolName === "inspect_resume_skills") {
    return language === "sv" ? "Kompetensstrukturen" : "Skills structure";
  }

  if (toolName === "list_resume_assignments") {
    return language === "sv" ? "Uppdragslistan" : "Assignment list";
  }

  if (toolName === "inspect_resume_section") {
    const section =
      input && typeof input === "object" && input !== null && "section" in input
        ? (input as { section?: unknown }).section
        : null;
    const assignmentId =
      input && typeof input === "object" && input !== null && "assignmentId" in input
        ? (input as { assignmentId?: unknown }).assignmentId
        : null;

    if (typeof section === "string") {
      if (section === "assignment" && typeof assignmentId === "string") {
        return language === "sv"
          ? `Uppdrag ${assignmentId.slice(0, 8)}`
          : `Assignment ${assignmentId.slice(0, 8)}`;
      }
      return language === "sv" ? `Sektionen ${section}` : `Section ${section}`;
    }
  }

  if (toolName === "inspect_assignment") {
    const assignmentId =
      input && typeof input === "object" && input !== null && "assignmentId" in input
        ? (input as { assignmentId?: unknown }).assignmentId
        : null;
    if (typeof assignmentId === "string") {
      return language === "sv"
        ? `Uppdrag ${assignmentId.slice(0, 8)}`
        : `Assignment ${assignmentId.slice(0, 8)}`;
    }
    return language === "sv" ? "Ett uppdrag" : "An assignment";
  }

  return null;
}

async function buildExplainMessage(
  db: Kysely<Database>,
  input: { conversationId: string; entityType: string; language: "sv" | "en" },
) {
  if (input.entityType !== "resume-revision-actions") {
    return input.language === "sv"
      ? "Det finns ingen särskild revisionsförklaring för den här chatten."
      : "There is no special revision explanation for this chat.";
  }

  const [workItems, suggestions, deliveries] = await Promise.all([
    listPersistedRevisionWorkItems(db, input.conversationId),
    listPersistedRevisionSuggestions(db, input.conversationId),
    db
      .selectFrom("ai_message_deliveries")
      .select(["tool_name", "payload", "created_at"])
      .where("conversation_id", "=", input.conversationId)
      .where("kind", "=", "tool_call")
      .orderBy("created_at", "asc")
      .execute(),
  ]);

  const inspectedTargets = deliveries
    .filter((delivery) => BACKEND_INSPECT_TOOLS.has(delivery.tool_name ?? ""))
    .map((delivery) => describeInspectedTarget(delivery.tool_name, delivery.payload, input.language))
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  const workItemById = new Map(workItems.map((item) => [item.work_item_id, item]));

  if (input.language === "sv") {
    return [
      "## Förklaring",
      "",
      "### Genomgånget innehåll",
      "",
      ...(inspectedTargets.length > 0
        ? inspectedTargets.map((target) => `- ${target}`)
        : ["- Inga inspekterade delar är registrerade ännu."]),
      "",
      "### Varför förslagen skapades",
      "",
      ...(suggestions.length > 0
        ? suggestions.flatMap((suggestion) => {
            const workItem = suggestion.work_item_id
              ? workItemById.get(suggestion.work_item_id) ?? null
              : null;
            return [
              `- **${suggestion.title}**`,
              `  Orsak: ${suggestion.description}`,
              `  Mål: ${suggestion.section}${suggestion.assignment_id ? ` (${suggestion.assignment_id.slice(0, 8)})` : ""}`,
              `  Status: ${suggestion.status === "accepted" ? "accepterad" : suggestion.status === "dismissed" ? "avfärdad" : "pending"}`,
              ...(workItem ? [`  Work item: ${workItem.title}`] : []),
            ];
          })
        : ["- Det finns inga persisterade förslag i den här revisionschatten ännu."]),
      "",
      "### Arbetsläge",
      "",
      ...(workItems.length > 0
        ? workItems.map((item) => `- **${item.title}**: ${item.status}${item.note ? ` — ${item.note}` : ""}`)
        : ["- Inga work items är registrerade ännu."]),
    ].join("\n");
  }

  return [
    "## Explanation",
    "",
    "### Reviewed Content",
    "",
    ...(inspectedTargets.length > 0
      ? inspectedTargets.map((target) => `- ${target}`)
      : ["- No inspected content has been recorded yet."]),
    "",
    "### Why Each Suggestion Was Created",
    "",
    ...(suggestions.length > 0
      ? suggestions.flatMap((suggestion) => {
          const workItem = suggestion.work_item_id
            ? workItemById.get(suggestion.work_item_id) ?? null
            : null;
          return [
            `- **${suggestion.title}**`,
            `  Reason: ${suggestion.description}`,
            `  Target: ${suggestion.section}${suggestion.assignment_id ? ` (${suggestion.assignment_id.slice(0, 8)})` : ""}`,
            `  Status: ${suggestion.status}`,
            ...(workItem ? [`  Work item: ${workItem.title}`] : []),
          ];
        })
      : ["- There are no persisted suggestions in this revision chat yet."]),
    "",
    "### Work State",
    "",
    ...(workItems.length > 0
      ? workItems.map((item) => `- **${item.title}**: ${item.status}${item.note ? ` — ${item.note}` : ""}`)
      : ["- No work items have been recorded yet."]),
  ].join("\n");
}

function slugifyRevisionGoal(goal: string) {
  return goal
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildRevisionBranchNameFromGoal(goal: string) {
  const slug = slugifyRevisionGoal(goal);
  return slug ? `revision/${slug}` : "revision/untitled";
}

function buildBranchCreatedMessage(language: "sv" | "en", branchName: string) {
  if (language === "sv") {
    return `Jag öppnar nu en ny revisionsgren för det här arbetet: ${branchName}.`;
  }

  return `Opening a new revision branch for this work now: ${branchName}.`;
}

async function createRevisionBranchFromConversation(
  db: Kysely<Database>,
  conversation: {
    id: string;
    created_by: string;
    entity_id: string;
    entity_type: string;
    system_prompt: string;
  },
  input: { goal: string },
) {
  if (conversation.entity_type !== "resume-revision-actions") {
    throw new ORPCError("FAILED_PRECONDITION", {
      message: "Revision branches can only be created from revision action conversations.",
    });
  }

  const branch = await db
    .selectFrom("resume_branches")
    .select(["id", "head_commit_id", "forked_from_commit_id"])
    .where("id", "=", conversation.entity_id)
    .executeTakeFirst();

  if (!branch) {
    throw new ORPCError("NOT_FOUND", {
      message: "Source branch not found for revision branch creation.",
    });
  }

  const fromCommitId = branch.head_commit_id ?? branch.forked_from_commit_id;
  if (!fromCommitId) {
    throw new ORPCError("FAILED_PRECONDITION", {
      message: "Missing fork point for revision branch creation.",
    });
  }

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", conversation.created_by)
    .executeTakeFirst();

  if (!user) {
    throw new ORPCError("NOT_FOUND", {
      message: "Conversation owner not found.",
    });
  }

  const newBranch = await forkResumeBranch(db, user, {
    fromCommitId,
    name: buildRevisionBranchNameFromGoal(input.goal),
  });

  return {
    branchId: newBranch.id,
    branchName: newBranch.name,
    goal: input.goal,
  };
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
        let branchHandoffCreated = false;

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

          if (toolCall.toolName === "create_revision_branch") {
            if (!isExplicitBranchCreationConfirmation(input.userMessage)) {
              const toolResult = {
                ok: false,
                error: "Branch creation requires an explicit user confirmation first.",
              };

              await insertAIDelivery(db, {
                conversationId: input.conversationId,
                kind: "tool_result",
                role: "tool",
                toolName: toolCall.toolName,
                payload: toolResult,
                content: toolResult.error,
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
                content: JSON.stringify(toolResult),
              });
              continue;
            }

            const output = await createRevisionBranchFromConversation(db, conversation, {
              goal:
                toolCall.input
                && typeof toolCall.input === "object"
                && toolCall.input !== null
                && "goal" in toolCall.input
                && typeof (toolCall.input as { goal?: unknown }).goal === "string"
                  ? (toolCall.input as { goal: string }).goal
                  : "Revision branch",
            });

            const toolResult = { ok: true, output };
            await insertAIDelivery(db, {
              conversationId: input.conversationId,
              kind: "tool_result",
              role: "tool",
              toolName: toolCall.toolName,
              payload: toolResult,
              content: JSON.stringify(toolResult.output),
            });

            const assistantBranchRow = await persistAssistantMessage(
              buildBranchCreatedMessage(
                detectConversationLanguage(conversation.system_prompt),
                output.branchName,
              ),
            );

            await db
              .updateTable("ai_conversations")
              .set({ is_closed: true, updated_at: new Date() })
              .where("id", "=", input.conversationId)
              .execute();

            assistantRow = assistantBranchRow;
            assistantContent = assistantBranchRow.content;
            branchHandoffCreated = true;
            break;
          }

          const persisted = await persistRevisionToolCallWorkItems(db, {
            conversationId: input.conversationId,
            branchId: conversation.entity_id,
            toolName: toolCall.toolName,
            toolCallInput: toolCall.input,
          });

          await persistRevisionToolCallSuggestions(db, {
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

        if (branchHandoffCreated) {
          break;
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
        if (isRevisionConversation && isWaitingForRevisionScopeDecision(assistantContent)) {
          if (!assistantRow || assistantRow.content !== assistantContent) {
            assistantRow = await persistAssistantMessage(assistantContent);
          }
          break;
        }

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

        if (conversation.entity_type === "resume-revision-actions" && isWaitingForRevisionScopeDecision(assistantContent)) {
          break;
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
