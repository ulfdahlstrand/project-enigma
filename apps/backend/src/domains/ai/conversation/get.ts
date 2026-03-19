import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

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
