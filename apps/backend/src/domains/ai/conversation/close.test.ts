import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import { closeAIConversation, createCloseAIConversationHandler } from "./close.js";

const CONV_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

const CONVERSATION_ROW = { id: CONV_ID, title: null };

const USER_MESSAGES = [
  { role: "user", content: "Help me improve my description" },
  { role: "assistant", content: "Sure, here is a suggestion…" },
  { role: "user", content: "Make it shorter" },
];

function buildDb(
  conversation: unknown = CONVERSATION_ROW,
  messages: unknown[] = []
) {
  const execute = vi.fn().mockResolvedValue(undefined);
  return {
    selectFrom: vi.fn().mockImplementation((table: string) => {
      if (table === "ai_conversations") {
        return {
          select: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(conversation),
            }),
          }),
        };
      }
      // ai_messages
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(messages),
            }),
          }),
        }),
      };
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ execute }),
      }),
    }),
  } as unknown as Kysely<Database>;
}

function buildOpenAI(title = "Improve Description"): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: title } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe("closeAIConversation", () => {
  it("generates a title even with a single user message", async () => {
    const db = buildDb(CONVERSATION_ROW, [{ role: "user", content: "Hi" }]);
    const openai = buildOpenAI();
    const result = await closeAIConversation(db, openai, CONV_ID);
    expect(result).toEqual({ success: true });
    expect((openai.chat.completions.create as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("skips title generation when there are no messages", async () => {
    const db = buildDb(CONVERSATION_ROW, []);
    const openai = buildOpenAI();
    await closeAIConversation(db, openai, CONV_ID);
    expect((openai.chat.completions.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("generates a title when 2+ user messages and no existing title", async () => {
    const db = buildDb(CONVERSATION_ROW, USER_MESSAGES);
    const openai = buildOpenAI("Improve Description");
    await closeAIConversation(db, openai, CONV_ID);
    expect(openai.chat.completions.create).toHaveBeenCalled();
  });

  it("skips title generation when conversation already has a title", async () => {
    const db = buildDb({ id: CONV_ID, title: "Existing Title" }, USER_MESSAGES);
    const openai = buildOpenAI();
    await closeAIConversation(db, openai, CONV_ID);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when conversation does not exist", async () => {
    const db = buildDb(null, []);
    const openai = buildOpenAI();
    await expect(closeAIConversation(db, openai, CONV_ID)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });
});

describe("createCloseAIConversationHandler", () => {
  it("closes conversation when authenticated", async () => {
    const db = buildDb(CONVERSATION_ROW, []);
    const openai = buildOpenAI();
    const handler = createCloseAIConversationHandler(db, openai);
    const result = await call(
      handler,
      { conversationId: CONV_ID },
      { context: { user: { id: USER_ID, role: "admin", email: "a@example.com" } } }
    );
    expect(result).toEqual({ success: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(CONVERSATION_ROW, []);
    const openai = buildOpenAI();
    const handler = createCloseAIConversationHandler(db, openai);
    await expect(
      call(handler, { conversationId: CONV_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
