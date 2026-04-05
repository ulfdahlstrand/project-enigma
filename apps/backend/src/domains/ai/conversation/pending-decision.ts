/**
 * Pending Decision
 *
 * Manages the `pending_decision` state on ai_conversations.
 * When the model asks a blocking yes/no question (e.g. "should I create a branch?"),
 * the conversation is locked until the user answers.
 *
 * The user may answer in any natural language — classifyDecision uses a
 * low-cost model call (~5 tokens out) to determine the intent.
 */

import type OpenAI from "openai";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { logger } from "../../../infra/logger.js";

const CLASSIFIER_MODEL = "gpt-4o-mini";

export type DecisionAnswer = "yes" | "no" | "unclear";

/**
 * Uses a minimal model call to classify whether the user's message is an
 * affirmative, negative, or unclear response to a yes/no question.
 */
export async function classifyDecision(
  openai: OpenAI,
  userMessage: string,
): Promise<DecisionAnswer> {
  try {
    const response = await openai.chat.completions.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 5,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify the user's reply to a yes/no question. "
            + "Respond with exactly one word: YES, NO, or UNCLEAR.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim().toUpperCase() ?? "";
    if (raw.startsWith("YES")) return "yes";
    if (raw.startsWith("NO")) return "no";
    return "unclear";
  } catch (error) {
    logger.error("Failed to classify decision", { error });
    return "unclear";
  }
}

export async function setPendingDecision(
  db: Kysely<Database>,
  conversationId: string,
  decision: string | null,
): Promise<void> {
  await db
    .updateTable("ai_conversations")
    .set({ pending_decision: decision })
    .where("id", "=", conversationId)
    .execute();
}
