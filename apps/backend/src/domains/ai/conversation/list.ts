import { implement } from "@orpc/server";
import type { Kysely } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthContext } from "../../../auth/require-auth.js";

export async function listAIConversations(
  db: Kysely<Database>,
  input: { entityType: string; entityId: string }
) {
  const rows = await db
    .selectFrom("ai_conversations")
    .selectAll()
    .where("entity_type", "=", input.entityType)
    .where("entity_id", "=", input.entityId)
    .orderBy("created_at", "asc")
    .execute();

  return {
    conversations: rows.map((row) => ({
      id: row.id,
      createdBy: row.created_by,
      entityType: row.entity_type,
      entityId: row.entity_id,
      systemPrompt: row.system_prompt,
      title: row.title,
      isClosed: row.is_closed,
      pendingDecision: row.pending_decision,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}

export const listAIConversationsHandler = implement(
  contract.listAIConversations
).handler(async ({ input, context }) => {
  requireAuth(context as AuthContext);
  return listAIConversations(getDb(), input);
});

export function createListAIConversationsHandler(db: Kysely<Database>) {
  return implement(contract.listAIConversations).handler(
    async ({ input, context }) => {
      requireAuth(context as AuthContext);
      return listAIConversations(db, input);
    }
  );
}
