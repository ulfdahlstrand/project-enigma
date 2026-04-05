import { implement } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

export async function resolveRevisionSuggestion(
  db: Kysely<Database>,
  input: { conversationId: string; suggestionId: string; status: "accepted" | "dismissed" },
): Promise<{ success: boolean }> {
  const result = await db
    .updateTable("ai_revision_suggestions")
    .set({
      status: input.status,
      resolved_at: new Date(),
    })
    .where("conversation_id", "=", input.conversationId)
    .where("suggestion_id", "=", input.suggestionId)
    .executeTakeFirst();

  return { success: (result.numUpdatedRows ?? 0n) > 0n };
}

export const resolveRevisionSuggestionHandler = implement(
  contract.resolveRevisionSuggestion,
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return resolveRevisionSuggestion(getDb(), input);
});

export function createResolveRevisionSuggestionHandler(db: Kysely<Database>) {
  return implement(contract.resolveRevisionSuggestion).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return resolveRevisionSuggestion(db, input);
    },
  );
}
