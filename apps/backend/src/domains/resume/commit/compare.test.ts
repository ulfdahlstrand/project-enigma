import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  compareResumeCommits,
  createCompareResumeCommitsHandler,
} from "./compare.js";
import {
  MOCK_ADMIN,
  MOCK_CONSULTANT,
  MOCK_CONSULTANT_2,
} from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BASE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const OTHER_RESUME_ID = "550e8400-e29b-41d4-a716-446655440022";

const BASE_CONTENT = {
  title: "Engineer",
  consultantTitle: null,
  presentation: ["I build things"],
  summary: null,
  language: "en",
  skills: [{ name: "TypeScript", level: "Expert", category: null, sortOrder: 1 }],
  assignments: [],
};

const HEAD_CONTENT = {
  ...BASE_CONTENT,
  title: "Senior Engineer",
  skills: [
    { name: "TypeScript", level: "Expert", category: null, sortOrder: 1 },
    { name: "Go", level: null, category: null, sortOrder: 2 },
  ],
};

const BASE_ROW = {
  id: BASE_COMMIT_ID,
  resume_id: RESUME_ID,
  content: BASE_CONTENT,
  employee_id: EMPLOYEE_ID_1,
};

const HEAD_ROW = {
  id: HEAD_COMMIT_ID,
  resume_id: RESUME_ID,
  content: HEAD_CONTENT,
  employee_id: EMPLOYEE_ID_1,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------
//
// Two independent selectFrom chains are needed (one per commit).
// We track which call index we're on so the first call returns baseRow
// and the second returns headRow.
//

function buildDbMock(opts: {
  baseRow?: unknown;
  headRow?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    baseRow = BASE_ROW,
    headRow = HEAD_ROW,
    employeeId = null,
  } = opts;

  const resolvedBase = baseRow === null ? undefined : baseRow;
  const resolvedHead = headRow === null ? undefined : headRow;

  // Employee lookup (resolveEmployeeId)
  const empExecuteTakeFirst = vi
    .fn()
    .mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Commit lookups — two separate chains, returned in order
  let commitCallCount = 0;
  const commitExecuteTakeFirst = vi.fn().mockImplementation(async () => {
    commitCallCount++;
    return commitCallCount === 1 ? resolvedBase : resolvedHead;
  });
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitInnerJoin = vi.fn().mockReturnValue({ select: commitSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: commitInnerJoin };
  });

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

// ---------------------------------------------------------------------------
// Tests — pure function
// ---------------------------------------------------------------------------

describe("compareResumeCommits", () => {
  it("returns diff with hasChanges=true when commits differ", async () => {
    const { db } = buildDbMock();

    const result = await compareResumeCommits(db, MOCK_ADMIN, {
      baseCommitId: BASE_COMMIT_ID,
      headCommitId: HEAD_COMMIT_ID,
    });

    expect(result.baseCommitId).toBe(BASE_COMMIT_ID);
    expect(result.headCommitId).toBe(HEAD_COMMIT_ID);
    expect(result.diff.hasChanges).toBe(true);
    expect(result.diff.scalars.title).toEqual({
      before: "Engineer",
      after: "Senior Engineer",
    });
    const goSkill = result.diff.skills.find((s) => s.name === "Go");
    expect(goSkill?.status).toBe("added");
  });

  it("returns diff with hasChanges=false when commits are identical", async () => {
    const { db } = buildDbMock({ headRow: { ...BASE_ROW, id: HEAD_COMMIT_ID } });

    const result = await compareResumeCommits(db, MOCK_ADMIN, {
      baseCommitId: BASE_COMMIT_ID,
      headCommitId: HEAD_COMMIT_ID,
    });

    expect(result.diff.hasChanges).toBe(false);
  });

  it("throws NOT_FOUND when base commit does not exist", async () => {
    const { db } = buildDbMock({ baseRow: null });

    await expect(
      compareResumeCommits(db, MOCK_ADMIN, {
        baseCommitId: BASE_COMMIT_ID,
        headCommitId: HEAD_COMMIT_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws NOT_FOUND when head commit does not exist", async () => {
    const { db } = buildDbMock({ headRow: null });

    await expect(
      compareResumeCommits(db, MOCK_ADMIN, {
        baseCommitId: BASE_COMMIT_ID,
        headCommitId: HEAD_COMMIT_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws BAD_REQUEST when commits belong to different resumes", async () => {
    const differentResumeHead = {
      ...HEAD_ROW,
      resume_id: OTHER_RESUME_ID,
    };
    const { db } = buildDbMock({ headRow: differentResumeHead });

    await expect(
      compareResumeCommits(db, MOCK_ADMIN, {
        baseCommitId: BASE_COMMIT_ID,
        headCommitId: HEAD_COMMIT_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST"
    );
  });

  it("allows consultant to compare commits on their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      compareResumeCommits(db, MOCK_CONSULTANT, {
        baseCommitId: BASE_COMMIT_ID,
        headCommitId: HEAD_COMMIT_ID,
      })
    ).resolves.toMatchObject({ baseCommitId: BASE_COMMIT_ID });
  });

  it("throws FORBIDDEN when consultant accesses another employee's commits", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      compareResumeCommits(db, MOCK_CONSULTANT_2, {
        baseCommitId: BASE_COMMIT_ID,
        headCommitId: HEAD_COMMIT_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — handler
// ---------------------------------------------------------------------------

describe("createCompareResumeCommitsHandler", () => {
  it("returns result for authenticated admin", async () => {
    const { db } = buildDbMock();
    const handler = createCompareResumeCommitsHandler(db);

    const result = await call(
      handler,
      { baseCommitId: BASE_COMMIT_ID, headCommitId: HEAD_COMMIT_ID },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.baseCommitId).toBe(BASE_COMMIT_ID);
    expect(result.diff).toBeDefined();
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createCompareResumeCommitsHandler(db);

    await expect(
      call(
        handler,
        { baseCommitId: BASE_COMMIT_ID, headCommitId: HEAD_COMMIT_ID },
        { context: {} }
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
