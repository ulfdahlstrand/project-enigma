import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createCommitTag } from "./create.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const RESUME_ID_1 = "550e8400-e29b-41d4-a716-446655440021";
const RESUME_ID_2 = "550e8400-e29b-41d4-a716-446655440022";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const TARGET_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440062";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440071";

const CREATED_TAG = {
  id: TAG_ID,
  source_commit_id: SOURCE_COMMIT_ID,
  target_commit_id: TARGET_COMMIT_ID,
  kind: "translation",
  created_at: new Date("2026-04-17T10:00:00.000Z"),
  created_by: EMPLOYEE_ID,
};

/**
 * Returns are queued: first executeTakeFirst call gets commitResults[0],
 * second gets commitResults[1], etc. null = simulate not found.
 */
function makeMockDb(opts: {
  sourceCommit?: { resume_id: string; employee_id: string } | null;
  targetCommit?: { resume_id: string; employee_id: string } | null;
  createdTag?: typeof CREATED_TAG;
} = {}): Kysely<Database> {
  const sourceCommit = opts.sourceCommit === null
    ? undefined
    : (opts.sourceCommit ?? { resume_id: RESUME_ID_1, employee_id: EMPLOYEE_ID });
  const targetCommit = opts.targetCommit === null
    ? undefined
    : (opts.targetCommit ?? { resume_id: RESUME_ID_2, employee_id: EMPLOYEE_ID });
  const createdTag = opts.createdTag ?? CREATED_TAG;

  const results = [sourceCommit, targetCommit];
  let callIndex = 0;

  return {
    selectFrom: vi.fn().mockImplementation(() => ({
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockImplementation(() => Promise.resolve(results[callIndex++])),
    })),
    insertInto: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue(createdTag),
    }),
  } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createCommitTag", () => {
  it("creates a tag and returns it", async () => {
    const db = makeMockDb();
    const result = await createCommitTag(db, MOCK_ADMIN, {
      sourceCommitId: SOURCE_COMMIT_ID,
      targetCommitId: TARGET_COMMIT_ID,
      kind: "translation",
    });

    expect(result).toMatchObject({
      id: TAG_ID,
      sourceCommitId: SOURCE_COMMIT_ID,
      targetCommitId: TARGET_COMMIT_ID,
      kind: "translation",
    });
  });

  it("throws NOT_FOUND when source commit does not exist", async () => {
    const db = makeMockDb({ sourceCommit: null });
    await expect(
      createCommitTag(db, MOCK_ADMIN, {
        sourceCommitId: SOURCE_COMMIT_ID,
        targetCommitId: TARGET_COMMIT_ID,
      })
    ).rejects.toThrow(ORPCError);
  });

  it("throws NOT_FOUND when target commit does not exist", async () => {
    const db = makeMockDb({ targetCommit: null });
    await expect(
      createCommitTag(db, MOCK_ADMIN, {
        sourceCommitId: SOURCE_COMMIT_ID,
        targetCommitId: TARGET_COMMIT_ID,
      })
    ).rejects.toThrow(ORPCError);
  });

  it("throws BAD_REQUEST when source and target are in the same resume", async () => {
    const db = makeMockDb({
      sourceCommit: { resume_id: RESUME_ID_1, employee_id: EMPLOYEE_ID },
      targetCommit: { resume_id: RESUME_ID_1, employee_id: EMPLOYEE_ID },
    });
    await expect(
      createCommitTag(db, MOCK_ADMIN, {
        sourceCommitId: SOURCE_COMMIT_ID,
        targetCommitId: TARGET_COMMIT_ID,
      })
    ).rejects.toThrow(ORPCError);
  });
});
