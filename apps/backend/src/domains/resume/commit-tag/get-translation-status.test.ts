import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getTranslationStatus } from "./get-translation-status.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const TARGET_RESUME_ID = "550e8400-e29b-41d4-a716-446655440022";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const TARGET_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440062";
const NEWER_HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440063";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440071";

const LATEST_TAG = {
  id: TAG_ID,
  source_commit_id: SOURCE_COMMIT_ID,
  target_commit_id: TARGET_COMMIT_ID,
  kind: "translation",
  created_at: new Date("2026-04-17T10:00:00.000Z"),
  created_by: EMPLOYEE_ID,
};

/**
 * Queues executeTakeFirst results: [sourceResume, latestTag, sourceBranch]
 * null = simulate not found for that slot.
 */
function makeMockDb(opts: {
  sourceResume?: { employee_id: string } | null;
  latestTag?: typeof LATEST_TAG | null;
  sourceHeadCommitId?: string | null;
} = {}): Kysely<Database> {
  const sourceResume = opts.sourceResume === null
    ? undefined
    : (opts.sourceResume ?? { employee_id: EMPLOYEE_ID });

  const latestTag = opts.latestTag === null
    ? undefined
    : (opts.latestTag ?? LATEST_TAG);

  const headCommitId = opts.sourceHeadCommitId === undefined
    ? SOURCE_COMMIT_ID
    : opts.sourceHeadCommitId;

  const sourceBranch = headCommitId !== null
    ? { head_commit_id: headCommitId }
    : undefined;

  const results = [sourceResume, latestTag, sourceBranch];
  let callIndex = 0;

  return {
    selectFrom: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockImplementation(() => Promise.resolve(results[callIndex++])),
    })),
  } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getTranslationStatus", () => {
  it("returns not stale when source head equals tag source commit", async () => {
    const db = makeMockDb({ sourceHeadCommitId: SOURCE_COMMIT_ID });
    const result = await getTranslationStatus(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      targetResumeId: TARGET_RESUME_ID,
    });

    expect(result.isStale).toBe(false);
    expect(result.latestTag).toMatchObject({ id: TAG_ID });
    expect(result.sourceHeadCommitId).toBe(SOURCE_COMMIT_ID);
  });

  it("returns stale when source head has moved beyond tag source commit", async () => {
    const db = makeMockDb({ sourceHeadCommitId: NEWER_HEAD_COMMIT_ID });
    const result = await getTranslationStatus(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      targetResumeId: TARGET_RESUME_ID,
    });

    expect(result.isStale).toBe(true);
    expect(result.sourceHeadCommitId).toBe(NEWER_HEAD_COMMIT_ID);
  });

  it("returns null tag and not stale when no tag exists yet", async () => {
    const db = makeMockDb({ latestTag: null, sourceHeadCommitId: NEWER_HEAD_COMMIT_ID });
    const result = await getTranslationStatus(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      targetResumeId: TARGET_RESUME_ID,
    });

    expect(result.latestTag).toBeNull();
    expect(result.isStale).toBe(false);
  });

  it("throws NOT_FOUND when source resume does not exist", async () => {
    const db = makeMockDb({ sourceResume: null });
    await expect(
      getTranslationStatus(db, MOCK_ADMIN, {
        resumeId: RESUME_ID,
        targetResumeId: TARGET_RESUME_ID,
      })
    ).rejects.toThrow(ORPCError);
  });
});
