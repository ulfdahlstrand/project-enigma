import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import {
  sendAIMessage,
  createSendAIMessageHandler,
} from "./message.js";
import {
  requiresExplicitAssignmentWorkQueue,
  isWaitingForRevisionScopeDecision,
  isManualResumeRequest,
} from "./revision-workflow-engine.js";
import * as toolExecution from "./tool-execution.js";
import * as revisionWorkItems from "./revision-work-items.js";
import * as revisionSuggestions from "./revision-suggestions.js";
import * as actionOrchestration from "./action-orchestration.js";
import * as pendingDecisionModule from "./pending-decision.js";

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
  is_closed: false,
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

const USER_MSG_ROW = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  conversation_id: CONV_ID,
  role: "user",
  content: "Improve this text.",
  created_at: new Date("2026-03-19T00:00:30.000Z"),
};

function buildOpenAI(content: string | null): OpenAI {
  const message = content !== null ? { content } : { content: null };
  const create = vi.fn().mockResolvedValue({ choices: [{ message }] });
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

function buildOpenAISequence(messages: Array<Record<string, unknown>>): OpenAI {
  const create = vi.fn();
  for (const message of messages) {
    create.mockResolvedValueOnce({ choices: [{ message }] });
  }
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

  it("throws FAILED_PRECONDITION when conversation is closed", async () => {
    const db = buildDb({
      conversation: { ...CONVERSATION_ROW, is_closed: true },
    });
    const openai = buildOpenAI("text");
    await expect(
      sendAIMessage(db, openai, { conversationId: CONV_ID, userMessage: "test" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FAILED_PRECONDITION"
    );
  });

  it("returns a persisted help message without calling OpenAI for /help", async () => {
    const helpConversation = {
      ...CONVERSATION_ROW,
      entity_type: "resume-revision-actions",
      system_prompt: "IMPORTANT: You must respond in Swedish.",
    };
    const helpAssistantRow = {
      ...ASSISTANT_MSG_ROW,
      content: "Här är vad du kan be mig om i den här revisionschatten:",
    };
    const db = buildDb({
      conversation: helpConversation,
      assistantRow: helpAssistantRow,
    });
    const openai = buildOpenAI("should not be used");
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "/help",
    });

    expect(result.content).toContain("revisionschatten");
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a persisted status summary without calling OpenAI for /status", async () => {
    const statusConversation = {
      ...CONVERSATION_ROW,
      entity_type: "resume-revision-actions",
      system_prompt: "IMPORTANT: You must respond in Swedish.",
    };
    const statusAssistantRow = {
      ...ASSISTANT_MSG_ROW,
      content: "Status för revisionsarbetet: 2 work item(s).",
    };
    const db = buildDb({
      conversation: statusConversation,
      assistantRow: statusAssistantRow,
    });
    const listSpy = vi.spyOn(revisionWorkItems, "listPersistedRevisionWorkItems").mockResolvedValue([
      {
        id: "row-1",
        conversation_id: CONV_ID,
        branch_id: BRANCH_ID,
        work_item_id: "work-item-1",
        title: "Review presentation",
        description: "Check presentation text.",
        section: "presentation",
        assignment_id: null,
        status: "completed",
        note: null,
        position: 0,
        attempt_count: 0,
        last_error: null,
        payload: null,
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "row-2",
        conversation_id: CONV_ID,
        branch_id: BRANCH_ID,
        work_item_id: "work-item-2",
        title: "Review assignments",
        description: "Check assignment text.",
        section: "assignment",
        assignment_id: null,
        status: "pending",
        note: null,
        position: 1,
        attempt_count: 0,
        last_error: null,
        payload: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as never);
    const openai = buildOpenAI("should not be used");
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "/status",
    });

    expect(result.content).toContain("Status för revisionsarbetet");
    expect(listSpy).toHaveBeenCalledWith(db, CONV_ID);
    expect(create).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("returns a persisted explanation without calling OpenAI for /explain", async () => {
    const explainConversation = {
      ...CONVERSATION_ROW,
      entity_type: "resume-revision-actions",
      system_prompt: "IMPORTANT: You must respond in Swedish.",
    };
    const explainAssistantRow = {
      ...ASSISTANT_MSG_ROW,
      content: "## Förklaring",
    };
    const db = buildDb({
      conversation: explainConversation,
      assistantRow: explainAssistantRow,
    });
    vi.spyOn(revisionWorkItems, "listPersistedRevisionWorkItems").mockResolvedValue([
      {
        id: "row-1",
        conversation_id: CONV_ID,
        branch_id: BRANCH_ID,
        work_item_id: "work-item-1",
        title: "Review presentation",
        description: "Check presentation text.",
        section: "presentation",
        assignment_id: null,
        status: "completed",
        note: null,
        position: 0,
        attempt_count: 0,
        last_error: null,
        payload: null,
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as never);
    vi.spyOn(revisionSuggestions, "listPersistedRevisionSuggestions").mockResolvedValue([
      {
        id: "s-row-1",
        conversation_id: CONV_ID,
        branch_id: BRANCH_ID,
        work_item_id: "work-item-1",
        suggestion_id: "suggestion-1",
        summary: "Suggested revision actions",
        title: "Fix spelling in presentation",
        description: "Correct the misspelled word in the presentation.",
        section: "presentation",
        assignment_id: null,
        suggested_text: "Updated text",
        status: "pending",
        skills: null,
        skill_scope: null,
        payload: null,
        resolved_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as never);

    const selectFrom = db.selectFrom as unknown as ReturnType<typeof vi.fn>;
    selectFrom.mockImplementationOnce(() => ({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(explainConversation),
        }),
      }),
    }));
    selectFrom.mockImplementationOnce(() => ({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }));
    selectFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                {
                  tool_name: "inspect_resume_section",
                  payload: { input: { section: "presentation" } },
                  created_at: new Date(),
                },
              ]),
            }),
          }),
        }),
      }),
    }));

    const openai = buildOpenAI("should not be used");
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "/explain",
    });

    expect(result.content).toContain("## Förklaring");
    expect(create).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

describe("requiresExplicitAssignmentWorkQueue", () => {
  it("returns true for whole-resume requests", () => {
    expect(requiresExplicitAssignmentWorkQueue(["jag vill ta bort qwerty från hela cvt"])).toBe(true);
    expect(requiresExplicitAssignmentWorkQueue(["fix spelling in the whole resume"])).toBe(true);
  });

  it("returns true for all-assignment requests", () => {
    expect(requiresExplicitAssignmentWorkQueue(["rätta stavfel i alla uppdrag"])).toBe(true);
    expect(requiresExplicitAssignmentWorkQueue(["fix all assignments"])).toBe(true);
  });

  it("returns false for narrow requests", () => {
    expect(requiresExplicitAssignmentWorkQueue(["fixa stavfel i presentationen"])).toBe(false);
    expect(requiresExplicitAssignmentWorkQueue(["fix the payer assignment"])).toBe(false);
  });
});

describe("isManualResumeRequest", () => {
  it("returns true for natural-language resume prompts", () => {
    expect(isManualResumeRequest("kan du återuppta det?")).toBe(true);
    expect(isManualResumeRequest("fortsätt med nästa pending item")).toBe(true);
    expect(isManualResumeRequest("please resume the remaining work")).toBe(true);
  });

  it("returns false for status-only prompts", () => {
    expect(isManualResumeRequest("vad återstår?")).toBe(false);
    expect(isManualResumeRequest("what is left?")).toBe(false);
  });
});

describe("isWaitingForRevisionScopeDecision", () => {
  it("returns true for a question about whether more changes are needed", () => {
    expect(
      isWaitingForRevisionScopeDecision(
        "Behöver du fler ändringar efter detta?"
      )
    ).toBe(true);
  });

  it("returns true for a question about whether the current scope is enough", () => {
    expect(
      isWaitingForRevisionScopeDecision(
        "Är det bara presentationen som ska ändras just nu?"
      )
    ).toBe(true);
  });

  it("returns false for branch-creation suggestions", () => {
    expect(
      isWaitingForRevisionScopeDecision(
        "Det låter som en bredare ändring. Vill du att jag skapar en dedikerad revisionsgren för detta? Svara med ja eller nej."
      )
    ).toBe(false);
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
  is_closed: false,
  pending_decision: null,
  created_at: new Date("2026-03-19T00:00:00.000Z"),
  updated_at: new Date("2026-03-19T00:00:00.000Z"),
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
 *   - call 2: re-fetch history after an internal loop step
 *   - subsequent: update conversation updated_at (updateTable handles that)
 */
function buildRevisionDb({
  userRow = USER_MSG_ROW as unknown,
  existingMessages = [] as unknown[],
  intermediateAssistantRows = [] as unknown[],
  finalRow = FINAL_MSG_ROW as unknown,
  updatedHistoryMessages = [] as unknown[],
  persistedWorkItemsSequence = [] as unknown[],
  conversationRow = REVISION_CONVERSATION_ROW as unknown,
} = {}) {
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValueOnce(userRow);
  for (const row of intermediateAssistantRows) {
    executeTakeFirstOrThrow.mockResolvedValueOnce(row);
  }
  executeTakeFirstOrThrow.mockResolvedValueOnce(finalRow);

  const returningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow });

  const insertInto = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
      returningAll,
    }),
  }));

  let selectFromCallIndex = 0;
  const selectFrom = vi.fn().mockImplementation((table?: string) => {
    if (table === "ai_message_deliveries") {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue(undefined),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "ai_revision_work_items") {
      const execute = vi.fn().mockImplementation(() =>
        Promise.resolve(
          persistedWorkItemsSequence.length > 0
            ? persistedWorkItemsSequence.shift()
            : [],
        ),
      );
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute,
            }),
          }),
        }),
      };
    }

    const i = selectFromCallIndex++;
    if (i === 0) {
      // Conversation lookup
      return {
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(conversationRow),
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
            execute: vi.fn().mockResolvedValue(
              i === 1 ? existingMessages : updatedHistoryMessages,
            ),
          }),
        }),
      }),
    };
  });

  const updateTable = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
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

    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-inspect",
          type: "function",
          function: {
            name: "inspect_resume",
            arguments: "{\"includeAssignments\":true}",
          },
        }],
      },
      { content: FINAL_MSG_ROW.content },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

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

  it("autogenerates broad work items after list_resume_assignments", async () => {
    vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: {
        totalAssignments: 2,
        assignments: [
          {
            assignmentId: "assignment-1",
            clientName: "Payer",
            role: "Developer",
          },
          {
            assignmentId: "assignment-2",
            clientName: "Assessio",
            role: "Consultant",
          },
        ],
      },
    });

    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-list-assignments",
          type: "function",
          function: {
            name: "list_resume_assignments",
            arguments: "{}",
          },
        }],
      },
      { content: "Kön är skapad." },
    ]);

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Kön är skapad.",
      },
    });

    const replaceSpy = vi.spyOn(revisionWorkItems, "replacePersistedRevisionWorkItems").mockResolvedValue();

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "fixa rättstavning i hela cvt",
    });

    expect(result.content).toBe("Kön är skapad.");
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(replaceSpy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        conversationId: CONV_ID,
        branchId: BRANCH_ID,
        items: expect.arrayContaining([
          expect.objectContaining({ section: "presentation" }),
          expect.objectContaining({ section: "assignment", assignmentId: "assignment-1" }),
          expect.objectContaining({ section: "assignment", assignmentId: "assignment-2" }),
        ]),
      }),
    );

    vi.restoreAllMocks();
  });

  it("persists work-item write tools and continues the loop", async () => {
    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-write",
          type: "function",
          function: {
            name: "set_revision_work_items",
            arguments: "{\"summary\":\"Review\",\"items\":[]}",
          },
        }],
      },
      { content: "Work items are now ready for review." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Work items are now ready for review.",
      },
    });

    const executeSpy = vi
      .spyOn(toolExecution, "executeBackendInspectTool")
      .mockResolvedValue({ ok: true, output: {} });
    const persistSpy = vi
      .spyOn(revisionWorkItems, "persistRevisionToolCallWorkItems")
      .mockResolvedValue(true);
    const suggestionPersistSpy = vi
      .spyOn(revisionSuggestions, "persistRevisionToolCallSuggestions")
      .mockResolvedValue(false);

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Run the write tool.",
    });

    expect(result.content).toBe("Work items are now ready for review.");
    expect(executeSpy).not.toHaveBeenCalled();
    expect(persistSpy).toHaveBeenCalledOnce();
    expect(suggestionPersistSpy).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("recovers from malformed revision tool arguments instead of throwing", async () => {
    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-bad-write",
          type: "function",
          function: {
            name: "set_revision_work_items",
            arguments: "{\"summary\":\"Review\",\"items\":[{\"id\":\"w-1\",\"title\":\"Broken\"}",
          },
        }],
      },
      {
        content: null,
        tool_calls: [{
          id: "call-good-write",
          type: "function",
          function: {
            name: "set_revision_work_items",
            arguments: "{\"summary\":\"Review\",\"items\":[]}",
          },
        }],
      },
      { content: "Work items are now ready for review." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Work items are now ready for review.",
      },
    });

    const persistSpy = vi
      .spyOn(revisionWorkItems, "persistRevisionToolCallWorkItems")
      .mockResolvedValue(true);

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Run the write tool.",
    });

    expect(result.content).toBe("Work items are now ready for review.");
    expect(persistSpy).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
  });

  it("requires work items before narrow revision suggestions are accepted", async () => {
    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-bad-suggestion",
          type: "function",
          function: {
            name: "set_revision_suggestions",
            arguments: "{\"summary\":\"Fix presentation\",\"suggestions\":[{\"id\":\"s-1\",\"title\":\"Fix presentation\",\"description\":\"Correct a typo.\",\"section\":\"presentation\",\"suggestedText\":\"Updated presentation\",\"status\":\"pending\"}]}",
          },
        }],
      },
      {
        content: null,
        tool_calls: [{
          id: "call-good-work-item",
          type: "function",
          function: {
            name: "set_revision_work_items",
            arguments: "{\"summary\":\"Review presentation\",\"items\":[{\"id\":\"work-item-1\",\"title\":\"Review presentation\",\"description\":\"Check the presentation text.\",\"section\":\"presentation\",\"status\":\"pending\"}]}",
          },
        }],
      },
      { content: "Work item created." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Work item created.",
      },
    });

    const persistWorkItemsSpy = vi
      .spyOn(revisionWorkItems, "persistRevisionToolCallWorkItems")
      .mockResolvedValue(true);
    const persistSuggestionsSpy = vi
      .spyOn(revisionSuggestions, "persistRevisionToolCallSuggestions")
      .mockResolvedValue(false);

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "fixa stavfel i presentationen",
    });

    expect(result.content).toBe("Work item created.");
    expect(persistWorkItemsSpy).toHaveBeenCalledOnce();
    expect(persistSuggestionsSpy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
  });

  it("auto-resumes from persisted pending work items when chat history has no fresh tool call", async () => {
    const openai = buildOpenAISequence([
      { content: "Jag tittar på det." },
      {
        content: null,
        tool_calls: [{
          id: "call-follow-up",
          type: "function",
          function: {
            name: "inspect_resume_section",
            arguments: "{\"section\":\"presentation\"}",
          },
        }],
      },
      { content: "Nu har jag fortsatt med nästa arbetsuppgift." },
      { content: "Nu har jag fortsatt med nästa arbetsuppgift." },
      { content: "Nu har jag fortsatt med nästa arbetsuppgift." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      intermediateAssistantRows: [
        {
          id: "msg-first",
          conversation_id: CONV_ID,
          role: "assistant",
          content: "Jag tittar på det.",
          created_at: new Date(),
        },
        {
          id: "msg-second",
          conversation_id: CONV_ID,
          role: "assistant",
          content: "Nu har jag fortsatt med nästa arbetsuppgift.",
          created_at: new Date(),
        },
        {
          id: "msg-third",
          conversation_id: CONV_ID,
          role: "assistant",
          content: "Nu har jag fortsatt med nästa arbetsuppgift.",
          created_at: new Date(),
        },
      ],
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Nu har jag fortsatt med nästa arbetsuppgift.",
      },
    });

    const listSpy = vi
      .spyOn(revisionWorkItems, "listPersistedRevisionWorkItems")
      .mockResolvedValueOnce([
        {
          id: "row-1",
          conversation_id: CONV_ID,
          branch_id: BRANCH_ID,
          work_item_id: "work-item-1",
          title: "Review presentation",
          description: "Check presentation text.",
          section: "presentation",
          assignment_id: null,
          status: "pending",
          note: null,
          position: 0,
          attempt_count: 0,
          last_error: null,
          payload: null,
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    const orchestrationSpy = vi.spyOn(
      actionOrchestration,
      "deriveNextActionOrchestrationMessageFromWorkItems",
    );
    const executeSpy = vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: { section: "presentation", text: "Current text" },
    });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "Fortsätt.",
    });

    expect(result.content).toBe("Nu har jag fortsatt med nästa arbetsuppgift.");
    expect(listSpy).toHaveBeenCalled();
    expect(orchestrationSpy).toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalled();
    expect(create.mock.calls.length).toBeGreaterThanOrEqual(3);

    vi.restoreAllMocks();
  });

  it("uses internal autostart when the user explicitly asks to resume pending work", async () => {
    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-follow-up",
          type: "function",
          function: {
            name: "inspect_resume_section",
            arguments: "{\"section\":\"presentation\"}",
          },
        }],
      },
      { content: "Nu återupptog jag nästa arbetsuppgift." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Nu återupptog jag nästa arbetsuppgift.",
      },
    });

    vi.spyOn(revisionWorkItems, "listPersistedRevisionWorkItems")
      .mockResolvedValueOnce([
        {
          id: "row-1",
          conversation_id: CONV_ID,
          branch_id: BRANCH_ID,
          work_item_id: "work-item-1",
          title: "Review presentation",
          description: "Check presentation text.",
          section: "presentation",
          assignment_id: null,
          status: "pending",
          note: null,
          position: 0,
          attempt_count: 0,
          last_error: null,
          payload: null,
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "row-1",
          conversation_id: CONV_ID,
          branch_id: BRANCH_ID,
          work_item_id: "work-item-1",
          title: "Review presentation",
          description: "Check presentation text.",
          section: "presentation",
          assignment_id: null,
          status: "pending",
          note: null,
          position: 0,
          attempt_count: 0,
          last_error: null,
          payload: null,
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: { section: "presentation", text: "Current text" },
    });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "kan du återuppta det?",
    });

    expect(result.content).toBe("Nu återupptog jag nästa arbetsuppgift.");
    const allPromptContents = create.mock.calls.flatMap((call) => {
      const args = call[0] as { messages?: Array<{ content?: string }> };
      return (args.messages ?? []).map((message) => message.content ?? "");
    });
    const autostartPrompt = allPromptContents.find((content) =>
      content.includes("[[internal_autostart]]"),
    );
    expect(autostartPrompt).toContain("Process only this work item now: work-item-1.");

    vi.restoreAllMocks();
  });

  it("waits for a scope decision question instead of forcing tools immediately", async () => {
    const openai = buildOpenAISequence([
      { content: "Kommer du att vilja göra fler ändringar efter det, eller är det bara presentationen som behöver rättas?" },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const waitingRow = {
      id: "msg-waiting",
      conversation_id: CONV_ID,
      role: "assistant",
      content: "Kommer du att vilja göra fler ändringar efter det, eller är det bara presentationen som behöver rättas?",
      created_at: new Date(),
    };
    const db = buildRevisionDb({
      finalRow: waitingRow,
    });

    const executeSpy = vi
      .spyOn(toolExecution, "executeBackendInspectTool")
      .mockResolvedValue({ ok: true, output: {} });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "jag vill fixa stavfel i presentationen",
    });

    expect(result.content).toBe(waitingRow.content);
    expect(create).toHaveBeenCalledTimes(1);
    expect(executeSpy).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("throws instead of persisting an empty assistant message after a revision loop step", async () => {
    vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: { section: "presentation", text: "Current text" },
    });

    const openai = buildOpenAISequence([
      {
        content: null,
        tool_calls: [{
          id: "call-inspect",
          type: "function",
          function: {
            name: "inspect_resume_section",
            arguments: "{\"section\":\"presentation\"}",
          },
        }],
      },
      { content: "" },
    ]);

    const db = buildRevisionDb();

    await expect(
      sendAIMessage(db, openai, {
        conversationId: CONV_ID,
        userMessage: "fixa stavfel i presentationen",
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });

    vi.restoreAllMocks();
  });

  it("passes revision tools to the follow-up OpenAI call after a backend inspect step", async () => {
    vi.spyOn(toolExecution, "executeBackendInspectTool").mockResolvedValue({
      ok: true,
      output: { section: "presentation", text: "Current text" },
    });

    const openai = buildOpenAISequence([
      {
        content: [
          "Tool execution requested.",
          "```json",
          JSON.stringify({
            type: "tool_call",
            toolName: "inspect_resume_section",
            input: { section: "presentation" },
          }),
          "```",
        ].join("\n"),
      },
      { content: "Jag har granskat presentationen." },
    ]);
    const create = openai.chat.completions.create as ReturnType<typeof vi.fn>;

    const db = buildRevisionDb({
      finalRow: {
        ...FINAL_MSG_ROW,
        content: "Jag har granskat presentationen.",
      },
    });

    const result = await sendAIMessage(db, openai, {
      conversationId: CONV_ID,
      userMessage: "fixa stavfel i presentationen",
    });

    expect(result.content).toBe("Jag har granskat presentationen.");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      tools: expect.any(Array),
    });

    vi.restoreAllMocks();
  });

  it("does not run the loop for non-revision entity types", async () => {
    const toolCallContent = "Inspecting.";

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
