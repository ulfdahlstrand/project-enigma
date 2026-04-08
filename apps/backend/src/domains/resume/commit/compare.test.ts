import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BASE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const HEAD_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440042";
const OTHER_RESUME_ID = "550e8400-e29b-41d4-a716-446655440022";
const TREE_ID_BASE = "550e8400-e29b-41d4-a716-000000000001";
const TREE_ID_HEAD = "550e8400-e29b-41d4-a716-000000000002";

const BASE_CONTENT = {
  title: "Engineer",
  consultantTitle: null,
  presentation: ["I build things"],
  summary: null,
  highlightedItems: [],
  language: "en",
  skillGroups: [],
  skills: [{ name: "TypeScript", category: null, sortOrder: 1 }],
  assignments: [],
};

const HEAD_CONTENT = {
  ...BASE_CONTENT,
  title: "Senior Engineer",
  skills: [
    { name: "TypeScript", category: null, sortOrder: 1 },
    { name: "Go", category: null, sortOrder: 2 },
  ],
};

const BASE_ROW = {
  id: BASE_COMMIT_ID,
  resume_id: RESUME_ID,
  tree_id: TREE_ID_BASE,
  employee_id: EMPLOYEE_ID_1,
};

const HEAD_ROW = {
  id: HEAD_COMMIT_ID,
  resume_id: RESUME_ID,
  tree_id: TREE_ID_HEAD,
  employee_id: EMPLOYEE_ID_1,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

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

  const empExecuteTakeFirst = vi
    .fn()
    .mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

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
  beforeEach(() => {
    vi.mocked(readTreeContent).mockImplementation(async (_db, treeId) =>
      treeId === TREE_ID_BASE ? BASE_CONTENT : HEAD_CONTENT
    );
  });

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
    vi.mocked(readTreeContent).mockResolvedValue(BASE_CONTENT);
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

  it("throws BAD_REQUEST when a commit has no tree_id (legacy format)", async () => {
    const legacyRow = { ...BASE_ROW, tree_id: null };
    const { db } = buildDbMock({ baseRow: legacyRow });

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
  beforeEach(() => {
    vi.mocked(readTreeContent).mockImplementation(async (_db, treeId) =>
      treeId === TREE_ID_BASE ? BASE_CONTENT : HEAD_CONTENT
    );
  });

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
