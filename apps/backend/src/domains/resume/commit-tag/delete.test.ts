import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { deleteCommitTag } from "./delete.js";
import { MOCK_ADMIN, MOCK_CONSULTANT } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const OTHER_EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440012";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440071";

/** null = simulate tag not found */
function makeMockDb(opts: {
  tag?: { id: string; source_commit_id: string; employee_id: string } | null;
} = {}): Kysely<Database> {
  const tagRow = opts.tag === null
    ? undefined
    : (opts.tag ?? { id: TAG_ID, source_commit_id: SOURCE_COMMIT_ID, employee_id: EMPLOYEE_ID });

  return {
    selectFrom: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(tagRow),
    }),
    deleteFrom: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: BigInt(1) }),
    }),
  } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deleteCommitTag", () => {
  it("deletes a tag and returns success", async () => {
    const db = makeMockDb();
    const result = await deleteCommitTag(db, MOCK_ADMIN, { id: TAG_ID });
    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when tag does not exist", async () => {
    const db = makeMockDb({ tag: null });
    await expect(
      deleteCommitTag(db, MOCK_ADMIN, { id: TAG_ID })
    ).rejects.toThrow(ORPCError);
  });

  it("throws FORBIDDEN when consultant does not own the source resume", async () => {
    const db = makeMockDb({
      tag: { id: TAG_ID, source_commit_id: SOURCE_COMMIT_ID, employee_id: OTHER_EMPLOYEE_ID },
    });
    await expect(
      deleteCommitTag(db, MOCK_CONSULTANT, { id: TAG_ID })
    ).rejects.toThrow(ORPCError);
  });
});
