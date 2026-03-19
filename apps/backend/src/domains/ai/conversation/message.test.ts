import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import { sendAIMessage, createSendAIMessageHandler } from "./message.js";

const CONV_ID = "550e8400-e29b-41d4-a716-446655440002";
const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440003";
const MSG_ID = "550e8400-e29b-41d4-a716-446655440010";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

const CONVERSATION_ROW = {
  id: CONV_ID,
  created_by: USER_ID,
  entity_type: "assignment",
  entity_id: ENTITY_ID,
  system_prompt: "You are a CV expert.",
  created_at: new Date("2026-03-19T00:00:00.000Z"),
  updated_at: new Date("2026-03-19T00:00:00.000Z"),
};

const ASSISTANT_MSG_ROW = {
  id: MSG_ID,
  conversation_id: CONV_ID,
  role: "assistant",
  content: "Here is an improved description.",
  created_at: new Date("2026-03-19T00:01:00.000Z"),
};

function buildOpenAI(content: string | null): OpenAI {
  const message = content !== null ? { content } : { content: null };
  const create = vi.fn().mockResolvedValue({ choices: [{ message }] });
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

function buildDb({
  conversation = CONVERSATION_ROW as unknown,
  existingMessages = [] as unknown[],
  assistantRow = ASSISTANT_MSG_ROW as unknown,
} = {}) {
  const executeTakeFirst = vi.fn().mockResolvedValue(conversation);
  const execute = vi.fn().mockResolvedValue(existingMessages);
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(assistantRow);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });

  const insertInto = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
      returningAll,
    }),
  }));

  const selectFrom = vi.fn().mockImplementation(() => ({
    selectAll: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        executeTakeFirst,
        orderBy: vi.fn().mockReturnValue({ execute }),
      }),
    }),
  }));

  const updateTable = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });

  return { selectFrom, insertInto, updateTable } as unknown as Kysely<Database>;
}

describe("sendAIMessage", () => {
  it("returns assistant message from AI response", async () => {
    const db = buildDb();
    const openai = buildOpenAI("Here is an improved description.");
    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Improve this text.",
    });
    expect(result).toMatchObject({
      id: MSG_ID,
      conversationId: CONV_ID,
      role: "assistant",
      content: "Here is an improved description.",
    });
  });

  it("sends system prompt + history + new user message to OpenAI", async () => {
    const existingMessages = [
      { id: "m1", conversation_id: CONV_ID, role: "user", content: "Hello", created_at: new Date() },
      { id: "m2", conversation_id: CONV_ID, role: "assistant", content: "Hi!", created_at: new Date() },
    ];
    const db = buildDb({ existingMessages });
    const openai = buildOpenAI("Better description.");
    const create = (openai.chat.completions.create as ReturnType<typeof vi.fn>);

    await sendAIMessage(db, openai, { conversationId: CONV_ID, userMessage: "Improve this." });

    expect(create).toHaveBeenCalledOnce();
    const args = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    expect(args.messages[0]).toEqual({ role: "system", content: "You are a CV expert." });
    expect(args.messages[1]).toEqual({ role: "user", content: "Hello" });
    expect(args.messages[2]).toEqual({ role: "assistant", content: "Hi!" });
    expect(args.messages[3]).toEqual({ role: "user", content: "Improve this." });
  });

  it("throws NOT_FOUND when conversation does not exist", async () => {
    const db = buildDb({ conversation: null });
    const openai = buildOpenAI("text");
    await expect(
      sendAIMessage(db, openai, { conversationId: CONV_ID, userMessage: "test" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws INTERNAL_SERVER_ERROR when AI returns empty content", async () => {
    const db = buildDb();
    const openai = buildOpenAI(null);
    await expect(
      sendAIMessage(db, openai, { conversationId: CONV_ID, userMessage: "test" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });
});

describe("createSendAIMessageHandler", () => {
  it("returns assistant message when authenticated", async () => {
    const db = buildDb();
    const openai = buildOpenAI("Here is an improved description.");
    const handler = createSendAIMessageHandler(db, openai);
    const result = await call(
      handler,
      { conversationId: CONV_ID, userMessage: "Improve this." },
      { context: { user: { id: USER_ID, role: "admin", email: "a@example.com" } } }
    );
    expect(result).toMatchObject({ role: "assistant" });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb();
    const openai = buildOpenAI("text");
    const handler = createSendAIMessageHandler(db, openai);
    await expect(
      call(handler, { conversationId: CONV_ID, userMessage: "test" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
