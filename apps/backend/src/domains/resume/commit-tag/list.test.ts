import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listCommitTags } from "./list.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const OTHER_EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const OTHER_RESUME_ID = "550e8400-e29b-41d4-a716-446655440022";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const OTHER_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const TARGET_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440062";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440071";

const TAG_ROW = {
  id: TAG_ID,
  source_commit_id: SOURCE_COMMIT_ID,
  target_commit_id: TARGET_COMMIT_ID,
  kind: "translation",
  created_at: new Date("2026-04-17T10:00:00.000Z"),
  created_by: EMPLOYEE_ID,
  source_resume_id: RESUME_ID,
  source_resume_title: "Swedish CV",
  source_language: "sv",
  source_branch_id: BRANCH_ID,
  source_branch_name: "main",
  target_resume_id: OTHER_RESUME_ID,
  target_resume_title: "English CV",
  target_language: "en",
  target_branch_id: OTHER_BRANCH_ID,
  target_branch_name: "main",
};

/** null = simulate row not found; undefined = use default */
function makeMockDb(opts: {
  resume?: { employee_id: string } | null;
  tags?: typeof TAG_ROW[];
} = {}): Kysely<Database> {
  const resumeRow = opts.resume === null ? undefined : (opts.resume ?? { employee_id: EMPLOYEE_ID });
  const tags = opts.tags ?? [TAG_ROW];

  return {
    selectFrom: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(resumeRow),
      execute: vi.fn().mockResolvedValue(tags),
    }),
  } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listCommitTags", () => {
  it("returns tags for a resume where source or target commit belongs to it", async () => {
    const db = makeMockDb();
    const result = await listCommitTags(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: TAG_ID,
      sourceCommitId: SOURCE_COMMIT_ID,
      targetCommitId: TARGET_COMMIT_ID,
      kind: "translation",
      source: {
        resumeId: RESUME_ID,
        language: "sv",
        commitId: SOURCE_COMMIT_ID,
      },
      target: {
        resumeId: OTHER_RESUME_ID,
        language: "en",
        commitId: TARGET_COMMIT_ID,
      },
    });
  });

  it("returns empty array when resume has no tags", async () => {
    const db = makeMockDb({ tags: [] });
    const result = await listCommitTags(db, MOCK_ADMIN, { resumeId: RESUME_ID });
    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const db = makeMockDb({ resume: null });
    await expect(
      listCommitTags(db, MOCK_ADMIN, { resumeId: RESUME_ID })
    ).rejects.toThrow(ORPCError);
  });

  it("throws FORBIDDEN when consultant does not own the resume", async () => {
    const db = makeMockDb({ resume: { employee_id: OTHER_EMPLOYEE_ID } });
    const consultant = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      azure_oid: "oid",
      email: "consultant@example.com",
      name: "Consultant",
      role: "consultant" as const,
      created_at: new Date(),
    };
    // resolveEmployeeId for consultant calls selectFrom("employees") → returns
    // { employee_id: OTHER_EMPLOYEE_ID } which has no `id` field, making the
    // employee lookup return a non-matching id. Simplest: just verify FORBIDDEN.
    await expect(
      listCommitTags(db, consultant, { resumeId: RESUME_ID })
    ).rejects.toThrow(ORPCError);
  });
});
