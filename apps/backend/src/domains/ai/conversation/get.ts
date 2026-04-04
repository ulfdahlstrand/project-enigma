import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

function normalizeSuggestionSkills(skills: unknown) {
  if (!Array.isArray(skills)) {
    return undefined;
  }

  const normalized = skills.flatMap((skill) => {
    if (typeof skill !== "object" || skill === null) {
      return [];
    }

    const row = skill as Record<string, unknown>;
    if (
      typeof row.name !== "string"
      || typeof row.sortOrder !== "number"
      || !("category" in row)
    ) {
      return [];
    }

    return [{
      name: row.name,
      level: typeof row.level === "string" || row.level === null ? row.level : null,
      category: typeof row.category === "string" || row.category === null ? row.category : null,
      sortOrder: row.sortOrder,
    }];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSuggestionSkillScope(skillScope: unknown) {
  if (typeof skillScope !== "object" || skillScope === null) {
    return undefined;
  }

  const row = skillScope as Record<string, unknown>;
  if (row.type !== "group_order" && row.type !== "group_contents") {
    return undefined;
  }

  const type = row.type;

  return {
    type: type as "group_order" | "group_contents",
    ...(typeof row.category === "string" ? { category: row.category } : {}),
  };
}

export async function getAIConversation(
  db: Kysely<Database>,
  conversationId: string
) {
  const conversation = await db
    .selectFrom("ai_conversations")
    .selectAll()
    .where("id", "=", conversationId)
    .executeTakeFirst();

  if (!conversation) {
    throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
  }

  const messages = await db
    .selectFrom("ai_messages")
    .selectAll()
    .where("conversation_id", "=", conversationId)
    .orderBy("created_at", "asc")
    .execute();

  const suggestionRows = await db
    .selectFrom("ai_revision_suggestions")
    .selectAll()
    .where("conversation_id", "=", conversationId)
    .orderBy("created_at", "asc")
    .execute();

  const latestBranchHandoffDelivery = await db
    .selectFrom("ai_message_deliveries")
    .select(["payload"])
    .where("conversation_id", "=", conversationId)
    .where("kind", "=", "tool_result")
    .where("tool_name", "=", "create_revision_branch")
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  const handoffPayload =
    latestBranchHandoffDelivery?.payload
    && typeof latestBranchHandoffDelivery.payload === "object"
    && latestBranchHandoffDelivery.payload !== null
    && "output" in latestBranchHandoffDelivery.payload
    && typeof (latestBranchHandoffDelivery.payload as { output?: unknown }).output === "object"
    && (latestBranchHandoffDelivery.payload as { output?: unknown }).output !== null
      ? (latestBranchHandoffDelivery.payload as {
          output: {
            branchId?: unknown;
            branchName?: unknown;
            goal?: unknown;
          };
        }).output
      : null;

  return {
    id: conversation.id,
    createdBy: conversation.created_by,
    entityType: conversation.entity_type,
    entityId: conversation.entity_id,
    systemPrompt: conversation.system_prompt,
    title: conversation.title,
    isClosed: conversation.is_closed,
    createdAt: conversation.created_at.toISOString(),
    updatedAt: conversation.updated_at.toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.created_at.toISOString(),
    })),
    revisionSuggestions: suggestionRows.length === 0
      ? null
      : {
          summary:
            suggestionRows.find((row) => row.summary && row.summary.trim().length > 0)?.summary
            ?? "Suggested revision actions",
          suggestions: suggestionRows.map((row) => ({
            id: row.suggestion_id,
            title: row.title,
            description: row.description,
            section: row.section,
            ...(row.assignment_id ? { assignmentId: row.assignment_id } : {}),
            suggestedText: row.suggested_text,
            ...(normalizeSuggestionSkills(row.skills) ? { skills: normalizeSuggestionSkills(row.skills) } : {}),
            ...(normalizeSuggestionSkillScope(row.skill_scope)
              ? { skillScope: normalizeSuggestionSkillScope(row.skill_scope) }
              : {}),
            status: row.status === "applied" ? "accepted" : row.status,
          })),
        },
    latestBranchHandoff:
      handoffPayload
      && typeof handoffPayload.branchId === "string"
      && typeof handoffPayload.branchName === "string"
        ? {
            branchId: handoffPayload.branchId,
            branchName: handoffPayload.branchName,
            goal: typeof handoffPayload.goal === "string" ? handoffPayload.goal : null,
          }
        : null,
  };
}

export const getAIConversationHandler = implement(
  contract.getAIConversation
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return getAIConversation(getDb(), input.conversationId);
});

export function createGetAIConversationHandler(db: Kysely<Database>) {
  return implement(contract.getAIConversation).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return getAIConversation(db, input.conversationId);
    }
  );
}
