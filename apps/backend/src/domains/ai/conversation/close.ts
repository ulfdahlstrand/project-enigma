import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../lib/openai-client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { generateConversationTitle } from "../lib/generate-title.js";

export async function closeAIConversation(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  conversationId: string
) {
  // Fetch current conversation to check if it already has a title
  const conversation = await db
    .selectFrom("ai_conversations")
    .select(["id", "title"])
    .where("id", "=", conversationId)
    .executeTakeFirst();

  if (!conversation) {
    throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
  }

  let title: string | null = conversation.title;

  // Only generate a title when there isn't one yet
  if (title === null) {
    const messages = await db
      .selectFrom("ai_messages")
      .select(["role", "content"])
      .where("conversation_id", "=", conversationId)
      .orderBy("created_at", "asc")
      .execute();

    if (messages.length > 0) {
      title = await generateConversationTitle(openaiClient, messages);
    }
  }

  await db
    .updateTable("ai_conversations")
    .set({ is_closed: true, updated_at: new Date(), ...(title !== null && { title }) })
    .where("id", "=", conversationId)
    .execute();

  return { success: true };
}

export const closeAIConversationHandler = implement(
  contract.closeAIConversation
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return closeAIConversation(getDb(), getOpenAIClient(), input.conversationId);
});

export function createCloseAIConversationHandler(
  db: Kysely<Database>,
  openaiClient: OpenAI
) {
  return implement(contract.closeAIConversation).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return closeAIConversation(db, openaiClient, input.conversationId);
    }
  );
}
