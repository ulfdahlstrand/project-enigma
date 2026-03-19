import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listAIConversations, createListAIConversationsHandler } from "./list.js";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440003";

const CONVERSATION_ROWS = [
  {
    id: "550e8400-e29b-41d4-a716-446655440010",
    created_by: USER_ID,
    entity_type: "assignment",
    entity_id: ENTITY_ID,
    system_prompt: "prompt",
    title: null,
    is_closed: false,
    created_at: new Date("2026-03-19T00:00:00.000Z"),
    updated_at: new Date("2026-03-19T01:00:00.000Z"),
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440011",
    created_by: USER_ID,
    entity_type: "assignment",
    entity_id: ENTITY_ID,
    system_prompt: "prompt2",
    title: null,
    is_closed: false,
    created_at: new Date("2026-03-18T00:00:00.000Z"),
    updated_at: new Date("2026-03-18T01:00:00.000Z"),
  },
];

const VALID_INPUT = { entityType: "assignment", entityId: ENTITY_ID };

function buildDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ execute });
  const where2 = vi.fn().mockReturnValue({ orderBy });
  const where1 = vi.fn().mockReturnValue({ where: where2 });
  const selectAll = vi.fn().mockReturnValue({ where: where1 });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  return { selectFrom } as unknown as Kysely<Database>;
}

describe("listAIConversations", () => {
  it("returns list of conversations for entity", async () => {
    const db = buildDb(CONVERSATION_ROWS);
    const result = await listAIConversations(db, VALID_INPUT);
    expect(result.conversations).toHaveLength(2);
    expect(result.conversations[0]).toMatchObject({
      entityType: "assignment",
      entityId: ENTITY_ID,
    });
  });

  it("returns empty list when no conversations exist", async () => {
    const db = buildDb([]);
    const result = await listAIConversations(db, VALID_INPUT);
    expect(result.conversations).toHaveLength(0);
  });

  it("maps output to camelCase", async () => {
    const db = buildDb(CONVERSATION_ROWS);
    const result = await listAIConversations(db, VALID_INPUT);
    expect(result.conversations[0]).not.toHaveProperty("created_by");
    expect(result.conversations[0]).toHaveProperty("createdBy");
  });
});

describe("createListAIConversationsHandler", () => {
  it("returns conversations when authenticated", async () => {
    const db = buildDb(CONVERSATION_ROWS);
    const handler = createListAIConversationsHandler(db);
    const result = await call(
      handler,
      VALID_INPUT,
      { context: { user: { id: USER_ID, role: "admin", email: "a@example.com" } } }
    );
    expect(result.conversations).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb(CONVERSATION_ROWS);
    const handler = createListAIConversationsHandler(db);
    await expect(
      call(handler, VALID_INPUT, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
