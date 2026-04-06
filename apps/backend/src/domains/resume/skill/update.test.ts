import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError, call } from "@orpc/server";
import { updateResumeSkill, createUpdateResumeSkillHandler } from "./update.js";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";

vi.mock("../../../auth/require-auth.js", () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from "../../../auth/require-auth.js";
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

function makeRow(
  overrides: Partial<{
    id: string;
    resume_id: string;
    group_id: string;
    name: string;
    sort_order: number;
  }> = {},
) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    resume_id: "550e8400-e29b-41d4-a716-446655440020",
    group_id: "550e8400-e29b-41d4-a716-446655440030",
    name: "TypeScript",
    sort_order: 0,
    ...overrides,
  };
}

function buildDb(row: ReturnType<typeof makeRow> | undefined, group = { name: "Languages", sort_order: 2 }) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const where = vi.fn().mockReturnValue({ returningAll: () => ({ executeTakeFirst }) });
  const set = vi.fn().mockReturnValue({ where });
  const updateTable = vi.fn().mockReturnValue({ set });

  const groupExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(group);
  const groupWhere = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: groupExecuteTakeFirstOrThrow });
  const groupSelect = vi.fn().mockReturnValue({ where: groupWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_skill_groups") return { select: groupSelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { updateTable, selectFrom } as unknown as Kysely<Database>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockReturnValue(undefined);
});

describe("updateResumeSkill (core function)", () => {
  it("updates provided fields and returns the current group-backed category", async () => {
    const row = makeRow({ name: "Go", group_id: "550e8400-e29b-41d4-a716-446655440031", sort_order: 5 });
    const db = buildDb(row, { name: "Backend", sort_order: 1 });

    const result = await updateResumeSkill(db, {
      id: row.id,
      name: "Go",
      groupId: row.group_id,
      sortOrder: 5,
    });

    expect(result).toEqual({
      id: row.id,
      resumeId: row.resume_id,
      groupId: row.group_id,
      name: "Go",
      category: "Backend",
      sortOrder: 5,
    });
  });

  it("allows partial update (name only)", async () => {
    const row = makeRow({ name: "Rust" });
    const db = buildDb(row);

    const result = await updateResumeSkill(db, { id: row.id, name: "Rust" });

    expect(result.name).toBe("Rust");
    expect(result.category).toBe("Languages");
  });

  it("throws NOT_FOUND when skill does not exist", async () => {
    const db = buildDb(undefined);

    await expect(updateResumeSkill(db, { id: "non-existent", name: "Anything" })).rejects.toThrow(ORPCError);
  });
});

describe("updateResumeSkillHandler (oRPC handler)", () => {
  it("calls requireAuth and delegates to updateResumeSkill", async () => {
    const row = makeRow();
    const db = buildDb(row);
    const handler = createUpdateResumeSkillHandler(db);

    await call(handler, { id: row.id, name: "TypeScript" }, { context: { user: { id: "u1" } } });

    expect(mockRequireAuth).toHaveBeenCalledOnce();
  });

  it("throws when unauthenticated", async () => {
    const db = buildDb(makeRow());
    mockRequireAuth.mockImplementation(() => {
      throw new ORPCError("UNAUTHORIZED");
    });
    const handler = createUpdateResumeSkillHandler(db);

    await expect(call(handler, { id: "550e8400-e29b-41d4-a716-446655440010", name: "TypeScript" }, { context: {} })).rejects.toThrow(ORPCError);
  });
});
