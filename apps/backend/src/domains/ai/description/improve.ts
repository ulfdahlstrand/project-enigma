import { implement, ORPCError } from "@orpc/server";
import OpenAI from "openai";
import { contract } from "@cv-tool/contracts";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { getDb } from "../../../db/client.js";
import { getOpenAIClient } from "../lib/openai-client.js";
import { buildImproveDescriptionPrompt } from "../lib/prompts.js";
import { getAIPromptFragmentsByKey } from "../../system/index.js";

const MODEL = "gpt-4o";
const MAX_TOKENS = 1024;

/**
 * Pure function that calls the OpenAI API to improve a CV assignment description.
 * Accepts the client as a parameter for testability.
 */
export async function improveDescription(
  client: OpenAI,
  input: { description: string; role?: string | undefined; clientName?: string | undefined },
  templates?: { systemTemplate?: string; userTemplate?: string },
): Promise<{ improvedDescription: string }> {
  const { system, user } = buildImproveDescriptionPrompt({
    description: input.description,
    ...(input.role !== undefined && { role: input.role }),
    ...(input.clientName !== undefined && { clientName: input.clientName }),
  }, templates);

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI returned empty or unexpected content",
    });
  }

  return { improvedDescription: text };
}

/**
 * oRPC handler using the production OpenAI client singleton.
 */
export const improveDescriptionHandler = implement(
  contract.improveDescription
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  const db = getDb();
  const fragments = await getAIPromptFragmentsByKey(db, "backend.improve-description");
  return improveDescription(
    getOpenAIClient(),
    input,
    {
      ...(fragments.system_template !== undefined ? { systemTemplate: fragments.system_template } : {}),
      ...(fragments.user_template !== undefined ? { userTemplate: fragments.user_template } : {}),
    },
  );
});

/**
 * Factory for creating a handler with an injected OpenAI client (for tests).
 */
export function createImproveDescriptionHandler(client: OpenAI) {
  return implement(contract.improveDescription).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return improveDescription(client, input);
    }
  );
}
