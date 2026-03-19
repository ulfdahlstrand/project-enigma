/**
 * Tests for updateResumeSkill handler.
 *
 * Acceptance criteria:
 *   - Updates name, level, and category when all are provided
 *   - Allows partial updates (only name, only level, only category)
 *   - Sets level/category to null when passed as null
 *   - Throws NOT_FOUND when the skill id does not exist
 *   - Requires auth (throws when no context)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError, call } from "@orpc/server";
import { updateResumeSkill, createUpdateResumeSkillHandler } from "./update.js";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

vi.mock("../../../auth/require-auth.js", () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from "../../../auth/require-auth.js";
const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<{
  id: string;
  cv_id: string;
  name: string;
  level: string | null;
  category: string | null;
  sort_order: number;
}> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    cv_id: "550e8400-e29b-41d4-a716-446655440020",
    name: "TypeScript",
    level: "Expert",
    category: "Languages",
    sort_order: 0,
    ...overrides,
  };
}

function buildDb(row: ReturnType<typeof makeRow> | undefined) {
  const executeTakeFirst = vi.fn().mockResolvedValue(row);
  const returning = vi.fn().mockReturnValue({ executeTakeFirst });
  const where = vi.fn().mockReturnValue({ returningAll: () => ({ executeTakeFirst }) });
  const set = vi.fn().mockReturnValue({ where });
  const updateTable = vi.fn().mockReturnValue({ set });
  return { updateTable } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockReturnValue(undefined);
});

describe("updateResumeSkill (core function)", () => {
  it("updates all fields when provided", async () => {
    const row = makeRow({ name: "Go", level: "Intermediate", category: "Backend" });
    const db = buildDb(row);

    const result = await updateResumeSkill(db, {
      id: "550e8400-e29b-41d4-a716-446655440010",
      name: "Go",
      level: "Intermediate",
      category: "Backend",
    });

    expect(result).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440010",
      cvId: "550e8400-e29b-41d4-a716-446655440020",
      name: "Go",
      level: "Intermediate",
      category: "Backend",
      sortOrder: 0,
    });
  });

  it("allows partial update (name only)", async () => {
    const row = makeRow({ name: "Rust" });
    const db = buildDb(row);

    const result = await updateResumeSkill(db, { id: "550e8400-e29b-41d4-a716-446655440010", name: "Rust" });

    expect(result.name).toBe("Rust");
  });

  it("sets level to null when passed as null", async () => {
    const row = makeRow({ level: null });
    const db = buildDb(row);

    const result = await updateResumeSkill(db, { id: "550e8400-e29b-41d4-a716-446655440010", level: null });

    expect(result.level).toBeNull();
  });

  it("throws NOT_FOUND when skill does not exist", async () => {
    const db = buildDb(undefined);

    await expect(
      updateResumeSkill(db, { id: "non-existent", name: "Anything" })
    ).rejects.toThrow(ORPCError);
  });
});

describe("updateResumeSkillHandler (oRPC handler)", () => {
  it("calls requireAuth and delegates to updateResumeSkill", async () => {
    const row = makeRow();
    const db = buildDb(row);
    const handler = createUpdateResumeSkillHandler(db);

    await call(handler, { id: "550e8400-e29b-41d4-a716-446655440010", name: "TypeScript" }, { context: { user: { id: "u1" } } });

    expect(mockRequireAuth).toHaveBeenCalledOnce();
  });

  it("throws when unauthenticated", async () => {
    const db = buildDb(makeRow());
    mockRequireAuth.mockImplementation(() => {
      throw new ORPCError("UNAUTHORIZED");
    });
    const handler = createUpdateResumeSkillHandler(db);

    await expect(
      call(handler, { id: "550e8400-e29b-41d4-a716-446655440010", name: "TypeScript" }, { context: {} })
    ).rejects.toThrow(ORPCError);
  });
});
