import { implement, ORPCError } from "@orpc/server";
import Anthropic from "@anthropic-ai/sdk";
import { contract } from "@cv-tool/contracts";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";
import { getAnthropicClient } from "../lib/anthropic-client.js";
import { buildImproveDescriptionPrompt } from "../lib/prompts.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

/**
 * Pure function that calls the Anthropic API to improve a CV assignment description.
 * Accepts the client as a parameter for testability.
 */
export async function improveDescription(
  client: Anthropic,
  input: { description: string; role?: string | undefined; clientName?: string | undefined }
): Promise<{ improvedDescription: string }> {
  const { system, user } = buildImproveDescriptionPrompt({
    description: input.description,
    ...(input.role !== undefined && { role: input.role }),
    ...(input.clientName !== undefined && { clientName: input.clientName }),
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AI returned empty or unexpected content",
    });
  }

  return { improvedDescription: firstBlock.text };
}

/**
 * oRPC handler using the production Anthropic client singleton.
 */
export const improveDescriptionHandler = implement(
  contract.improveDescription
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return improveDescription(getAnthropicClient(), input);
});

/**
 * Factory for creating a handler with a injected Anthropic client (for tests).
 */
export function createImproveDescriptionHandler(client: Anthropic) {
  return implement(contract.improveDescription).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return improveDescription(client, input);
    }
  );
}
