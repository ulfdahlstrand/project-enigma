import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getAIConversation, createGetAIConversationHandler } from "./get.js";

const CONV_ID = "550e8400-e29b-41d4-a716-446655440002";
const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440003";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

const CONVERSATION_ROW = {
  id: CONV_ID,
  created_by: USER_ID,
  entity_type: "assignment",
  entity_id: ENTITY_ID,
  system_prompt: "You are a CV expert.",
  title: null,
  is_closed: false,
  created_at: new Date("2026-03-19T00:00:00.000Z"),
  updated_at: new Date("2026-03-19T00:00:00.000Z"),
};

const MESSAGE_ROWS = [
  {
    id: "550e8400-e29b-41d4-a716-446655440020",
    conversation_id: CONV_ID,
    role: "user",
    content: "Hello",
    created_at: new Date("2026-03-19T00:00:30.000Z"),
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440021",
    conversation_id: CONV_ID,
    role: "assistant",
    content: "Hi there!",
    created_at: new Date("2026-03-19T00:01:00.000Z"),
  },
];

function buildDb(conversation: unknown, messages: unknown[]) {
  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "ai_conversations") {
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(conversation),
          }),
        }),
      };
    }
    if (table === "ai_messages") {
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(messages),
            }),
          }),
        }),
      };
    }
    if (table === "ai_revision_suggestions") {
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(undefined),
              }),
            }),
          }),
        }),
      }),
    };
  });
  return { selectFrom } as unknown as Kysely<Database>;
}

describe("getAIConversation", () => {
  it("returns conversation with messages", async () => {
    const db = buildDb(CONVERSATION_ROW, MESSAGE_ROWS);
    const result = await getAIConversation(db, CONV_ID);
    expect(result).toMatchObject({
      id: CONV_ID,
      createdBy: USER_ID,
      entityType: "assignment",
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ role: "user", content: "Hello" });
    expect(result.messages[1]).toMatchObject({ role: "assistant", content: "Hi there!" });
    expect(result.revisionSuggestions).toBeNull();
  });

  it("throws NOT_FOUND when conversation does not exist", async () => {
    const db = buildDb(undefined, []);
    await expect(getAIConversation(db, CONV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

describe("createGetAIConversationHandler", () => {
  it("returns conversation when authenticated", async () => {
    const db = buildDb(CONVERSATION_ROW, MESSAGE_ROWS);
    const handler = createGetAIConversationHandler(db);
    const result = await call(
      handler,
      { conversationId: CONV_ID },
      { context: { user: { id: USER_ID, role: "admin", email: "a@example.com" } } }
    );
    expect(result).toMatchObject({ id: CONV_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(CONVERSATION_ROW, MESSAGE_ROWS);
    const handler = createGetAIConversationHandler(db);
    await expect(
      call(handler, { conversationId: CONV_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
