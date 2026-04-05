import type { Kysely } from "kysely";
import type { Database, NewAIMessageDelivery } from "../../../db/types.js";

export type AIMessageDeliveryKind =
  | "visible_message"
  | "internal_message"
  | "tool_call"
  | "tool_result";

type InsertDeliveryInput = {
  conversationId: string;
  aiMessageId?: string | null;
  kind: AIMessageDeliveryKind;
  role?: string | null;
  content?: string | null;
  toolName?: string | null;
  payload?: unknown;
};

export async function insertAIDelivery(
  db: Kysely<Database>,
  input: InsertDeliveryInput,
) {
  const row: NewAIMessageDelivery = {
    conversation_id: input.conversationId,
    ai_message_id: input.aiMessageId ?? null,
    kind: input.kind,
    role: input.role ?? null,
    content: input.content ?? null,
    tool_name: input.toolName ?? null,
    payload: input.payload === undefined ? null : input.payload,
  };

  await db.insertInto("ai_message_deliveries").values(row).execute();
}
