import { implement, ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../lib/openai-client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { logger } from "../../../infra/logger.js";
import { sendAIMessage } from "./message.js";
import { INTERNAL_AUTOSTART_PREFIX } from "./tool-parsing.js";

const MODEL = "gpt-4o";
const MAX_TOKENS = 512;

export async function createAIConversation(
  db: Kysely<Database>,
  openaiClient: OpenAI,
  input: {
    entityType: string;
    entityId: string;
    systemPrompt: string;
    title?: string | undefined;
    kickoffMessage?: string | undefined;
    autoStartMessage?: string | undefined;
  },
  userId: string
) {
  // Resume an existing open conversation for the same entity rather than
  // creating a duplicate.
  const existing = await db
    .selectFrom("ai_conversations")
    .selectAll()
    .where("entity_type", "=", input.entityType)
    .where("entity_id", "=", input.entityId)
    .where("created_by", "=", userId)
    .where("is_closed", "=", false)
    .orderBy("updated_at", "desc")
    .executeTakeFirst();

  if (existing) {
    logger.info("AI conversation resumed", {
      conversationId: existing.id,
      entityType: input.entityType,
      entityId: input.entityId,
      userId,
    });
    return {
      id: existing.id,
      createdBy: existing.created_by,
      entityType: existing.entity_type,
      entityId: existing.entity_id,
      systemPrompt: existing.system_prompt,
      title: existing.title,
      isClosed: existing.is_closed,
      createdAt: existing.created_at.toISOString(),
      updatedAt: existing.updated_at.toISOString(),
    };
  }

  const row = await db
    .insertInto("ai_conversations")
    .values({
      created_by: userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      system_prompt: input.systemPrompt,
      title: input.title ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  logger.info("AI conversation created", {
    conversationId: row.id,
    entityType: input.entityType,
    entityId: input.entityId,
    hasKickoffMessage: Boolean(input.kickoffMessage),
    userId,
  });

  // Send the kickoff message to the AI (not stored) and save only the greeting.
  if (input.kickoffMessage) {
    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.kickoffMessage },
      ],
    });

    const greeting = response.choices[0]?.message?.content;
    if (!greeting) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "AI returned empty greeting",
      });
    }

    await db
      .insertInto("ai_messages")
      .values({
        conversation_id: row.id,
        role: "assistant",
        content: greeting,
      })
      .execute();

    logger.info("AI kickoff greeting stored", {
      conversationId: row.id,
      greetingLength: greeting.length,
    });
  }

  if (input.autoStartMessage) {
    await sendAIMessage(db, openaiClient, {
      conversationId: row.id,
      userMessage: `${INTERNAL_AUTOSTART_PREFIX} ${input.autoStartMessage}`,
    });
  }

  return {
    id: row.id,
    createdBy: row.created_by,
    entityType: row.entity_type,
    entityId: row.entity_id,
    systemPrompt: row.system_prompt,
    title: row.title,
    isClosed: row.is_closed,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const createAIConversationHandler = implement(
  contract.createAIConversation
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return createAIConversation(getDb(), getOpenAIClient(), input, user.id);
});

export function createCreateAIConversationHandler(db: Kysely<Database>, openaiClient: OpenAI) {
  return implement(contract.createAIConversation).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return createAIConversation(db, openaiClient, input, user.id);
    }
  );
}
