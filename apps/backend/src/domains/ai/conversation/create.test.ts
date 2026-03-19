import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import { createAIConversation, createCreateAIConversationHandler } from "./create.js";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CONV_ID = "550e8400-e29b-41d4-a716-446655440002";
const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440003";

const RETURNED_ROW = {
  id: CONV_ID,
  created_by: USER_ID,
  entity_type: "assignment",
  entity_id: ENTITY_ID,
  system_prompt: "You are a helpful assistant.",
  title: null,
  is_closed: false,
  created_at: new Date("2026-03-19T00:00:00.000Z"),
  updated_at: new Date("2026-03-19T00:00:00.000Z"),
};

const VALID_INPUT = {
  entityType: "assignment",
  entityId: ENTITY_ID,
  systemPrompt: "You are a helpful assistant.",
};

function buildOpenAI(greeting: string): OpenAI {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: greeting } }],
  });
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

function buildDb(row: unknown) {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(row);
  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const execute = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ returningAll, execute });
  const insertInto = vi.fn().mockReturnValue({ values });

  // "resume existing open conversation" check — returns null so a new one is created
  const executeTakeFirst = vi.fn().mockResolvedValue(null);
  const orderBy = vi.fn().mockReturnValue({ executeTakeFirst });
  const where4 = vi.fn().mockReturnValue({ orderBy });
  const where3 = vi.fn().mockReturnValue({ where: where4 });
  const where2 = vi.fn().mockReturnValue({ where: where3 });
  const where1 = vi.fn().mockReturnValue({ where: where2 });
  const selectAll = vi.fn().mockReturnValue({ where: where1 });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });

  return { insertInto, selectFrom } as unknown as Kysely<Database>;
}

describe("createAIConversation", () => {
  it("inserts and returns the new conversation", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hello!");
    const result = await createAIConversation(db, openai, VALID_INPUT, USER_ID);
    expect(result).toEqual({
      id: CONV_ID,
      createdBy: USER_ID,
      entityType: "assignment",
      entityId: ENTITY_ID,
      systemPrompt: "You are a helpful assistant.",
      title: null,
      isClosed: false,
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z",
    });
  });

  it("maps output to camelCase", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hello!");
    const result = await createAIConversation(db, openai, VALID_INPUT, USER_ID);
    expect(result).not.toHaveProperty("created_by");
    expect(result).toHaveProperty("createdBy");
  });

  it("calls OpenAI and stores greeting when kickoffMessage is provided", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hi! I can see you want to improve your assignment description.");
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    await createAIConversation(
      db,
      openai,
      { ...VALID_INPUT, kickoffMessage: "Start the conversation." },
      USER_ID
    );

    expect(create).toHaveBeenCalledOnce();
    // Verify the kickoff message was sent to OpenAI
    const args = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    expect(args.messages.some((m) => m.role === "user" && m.content === "Start the conversation.")).toBe(true);
  });

  it("does not call OpenAI when no kickoffMessage is provided", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hello!");
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    await createAIConversation(db, openai, VALID_INPUT, USER_ID);

    expect(create).not.toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when OpenAI returns empty greeting", async () => {
    const db = buildDb(RETURNED_ROW);
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;

    await expect(
      createAIConversation(
        db,
        openai,
        { ...VALID_INPUT, kickoffMessage: "Start." },
        USER_ID
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "INTERNAL_SERVER_ERROR"
    );
  });
});

describe("createCreateAIConversationHandler", () => {
  it("creates conversation when authenticated", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hello!");
    const handler = createCreateAIConversationHandler(db, openai);
    const result = await call(
      handler,
      VALID_INPUT,
      { context: { user: { id: USER_ID, role: "admin", email: "a@example.com" } } }
    );
    expect(result).toMatchObject({ id: CONV_ID });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(RETURNED_ROW);
    const openai = buildOpenAI("Hello!");
    const handler = createCreateAIConversationHandler(db, openai);
    await expect(
      call(handler, VALID_INPUT, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
