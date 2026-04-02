import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import { sendAIMessage, createSendAIMessageHandler } from "./message.js";
import * as toolExecution from "./tool-execution.js";

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

// ---------------------------------------------------------------------------
// Backend tool-call loop
// ---------------------------------------------------------------------------

const BRANCH_ID = "10000000-0000-4000-8000-000000000001";

const REVISION_CONVERSATION_ROW = {
  id: CONV_ID,
  created_by: USER_ID,
  entity_type: "resume-revision-actions",
  entity_id: BRANCH_ID,
  system_prompt: "You are a revision assistant.",
  created_at: new Date("2026-03-19T00:00:00.000Z"),
  updated_at: new Date("2026-03-19T00:00:00.000Z"),
};

const TOOL_CALL_MSG_ROW = {
  id: "msg-tool-call",
  conversation_id: CONV_ID,
  role: "assistant",
  content: '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{"includeAssignments":true}}\n```',
  created_at: new Date("2026-03-19T00:01:00.000Z"),
};

const FINAL_MSG_ROW = {
  id: "msg-final",
  conversation_id: CONV_ID,
  role: "assistant",
  content: "Here is my analysis based on the resume.",
  created_at: new Date("2026-03-19T00:02:00.000Z"),
};

/**
 * Build a DB mock suitable for the tool-call loop tests.
 *
 * `selectFrom` is called multiple times in the loop:
 *   - call 0: fetch conversation
 *   - call 1: fetch existing messages
 *   - call 2: re-fetch history after tool result insert (inside loop iteration)
 *   - subsequent: update conversation updated_at (updateTable handles that)
 */
function buildRevisionDb({
  toolCallRow = TOOL_CALL_MSG_ROW as unknown,
  finalRow = FINAL_MSG_ROW as unknown,
  updatedHistoryMessages = [] as unknown[],
} = {}) {
  const executeTakeFirstOrThrow = vi
    .fn()
    .mockResolvedValueOnce(toolCallRow)  // 1st insert (tool call response)
    .mockResolvedValueOnce(finalRow);    // 2nd insert (final response)

  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });

  const insertInto = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
      returningAll,
    }),
  }));

  let selectFromCallIndex = 0;
  const selectFrom = vi.fn().mockImplementation(() => {
    const i = selectFromCallIndex++;
    if (i === 0) {
      // Conversation lookup
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(REVISION_CONVERSATION_ROW),
            orderBy: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      };
    }
    // History queries (initial + re-fetch)
    return {
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(null),
          orderBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue(updatedHistoryMessages),
          }),
        }),
      }),
    };
  });

  const updateTable = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });

  return { selectFrom, insertInto, updateTable } as unknown as Kysely<Database>;
}

describe("sendAIMessage — backend tool-call loop", () => {
  it("executes backend inspect tool and returns final non-tool-call response", async () => {
    vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: { resumeId: BRANCH_ID, employeeName: "Ada" },
    });

    // First call: tool call response. Second call: final response.
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: TOOL_CALL_MSG_ROW.content } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: FINAL_MSG_ROW.content } }] });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;

    const db = buildRevisionDb();
    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Start the revision.",
    });

    expect(result.content).toBe(FINAL_MSG_ROW.content);
    expect(toolExecution.executeBackendInspectTool).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("stops loop when tool is not a backend inspect tool", async () => {
    const writeToolContent =
      '```json\n{"type":"tool_call","toolName":"set_revision_work_items","input":{}}\n```';

    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: writeToolContent } }],
    });
    const openai = { chat: { completions: { create } } } as unknown as OpenAI;

    const writeToolRow = {
      id: "msg-write",
      conversation_id: CONV_ID,
      role: "assistant",
      content: writeToolContent,
      created_at: new Date(),
    };
    const db = buildRevisionDb({ toolCallRow: writeToolRow, finalRow: writeToolRow });

    const executeSpy = vi
      .spyOn(toolExecution, "executeBackendInspectTool")
      .mockResolvedValue({ ok: true, output: {} });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Run the write tool.",
    });

    expect(result.content).toBe(writeToolContent);
    expect(executeSpy).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it("does not run the loop for non-revision entity types", async () => {
    const toolCallContent =
      '```json\n{"type":"tool_call","toolName":"inspect_resume","input":{}}\n```';

    // Use a DB that returns the tool call content in the assistant row
    const toolCallRow = { ...ASSISTANT_MSG_ROW, id: "msg-tc", content: toolCallContent };
    const db = buildDb({
      conversation: { ...CONVERSATION_ROW, entity_type: "assignment" },
      assistantRow: toolCallRow,
    });
    const openai = buildOpenAI(toolCallContent);

    const executeSpy = vi
      .spyOn(toolExecution, "executeBackendInspectTool")
      .mockResolvedValue({ ok: true, output: {} });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Inspect it.",
    });

    expect(result.content).toBe(toolCallContent);
    expect(executeSpy).not.toHaveBeenCalled();

    vi.restoreAllMocks();
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
