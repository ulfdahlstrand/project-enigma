import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { forkResumeBranch, createForkResumeBranchHandler } from "./fork.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readTreeContent } from "../lib/read-tree-content.js";

vi.mock("../lib/read-tree-content.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const NEW_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const SNAPSHOT_ASSIGNMENT = {
  assignmentId: "550e8400-e29b-41d4-a716-446655440051",
  clientName: "Acme Corp",
  role: "Engineer",
  description: "Built things",
  startDate: "2024-01-01",
  endDate: null,
  technologies: [],
  isCurrent: true,
  keywords: null,
  type: null,
  highlight: true,
  sortOrder: 0,
};

const DEFAULT_TREE_ID = "550e8400-e29b-41d4-a716-000000000099";

const DEFAULT_CONTENT = {
  title: "My Resume",
  consultantTitle: "Senior Developer",
  presentation: ["Para 1"],
  summary: "Summary text",
  highlightedItems: [],
  language: "sv",
  skillGroups: [],
  skills: [],
  assignments: [SNAPSHOT_ASSIGNMENT],
};

const COMMIT_ROW = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  employee_id: EMPLOYEE_ID_1,
  tree_id: DEFAULT_TREE_ID,
};

const NEW_BRANCH_ROW = {
  id: NEW_BRANCH_ID,
  resume_id: RESUME_ID,
  name: "Swedish Variant",
  language: "sv",
  is_main: false,
  head_commit_id: null,
  forked_from_commit_id: COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  commitRow?: unknown;
  newBranchRow?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    commitRow = COMMIT_ROW,
    newBranchRow = NEW_BRANCH_ROW,
    employeeId = null,
  } = opts;

  const resolvedCommit = commitRow === null ? undefined : commitRow;

  // Employee lookup (for consultant auth)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Commit + resume join
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedCommit);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitInnerJoin = vi.fn().mockReturnValue({ select: commitSelect });

  // Branch insert
  const branchInsertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(newBranchRow);
  const branchInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: branchInsertExecuteTakeFirstOrThrow });
  const branchInsertValues = vi.fn().mockReturnValue({ returningAll: branchInsertReturningAll });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_branches") return { values: branchInsertValues };
    return {};
  });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { innerJoin: commitInnerJoin };
  });

  const db = { selectFrom, insertInto } as unknown as Kysely<Database>;
  return { db, branchInsertValues, commitWhere };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("forkResumeBranch", () => {
  beforeEach(() => {
    vi.mocked(readTreeContent).mockResolvedValue(DEFAULT_CONTENT as never);
  });

  it("creates a new branch forked from the given commit", async () => {
    const { db, branchInsertValues } = buildDbMock();

    const result = await forkResumeBranch(db, MOCK_ADMIN, {
      fromCommitId: COMMIT_ID,
      name: "Swedish Variant",
    });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        name: "Swedish Variant",
        forked_from_commit_id: COMMIT_ID,
        head_commit_id: null,
        is_main: false,
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(result.id).toBe(NEW_BRANCH_ID);
    expect(result.headCommitId).toBeNull();
    expect(result.forkedFromCommitId).toBe(COMMIT_ID);
    expect(result.isMain).toBe(false);
  });

  it("does not create any commits on fork — headCommitId is null", async () => {
    const { db } = buildDbMock();

    const result = await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    // The branch should have no HEAD commit; the first real save will create commit #1
    expect(result.headCommitId).toBeNull();
  });

  it("normalises legacy AI revision names to revision-prefixed branch names", async () => {
    const { db, branchInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, {
      fromCommitId: COMMIT_ID,
      name: "AI revision: Review presentation",
    });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "revision/review-presentation" }),
    );
  });

  it("keeps revision-prefixed branch names in normalized slug form", async () => {
    const { db, branchInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, {
      fromCommitId: COMMIT_ID,
      name: "revision/Review presentation",
    });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "revision/review-presentation" }),
    );
  });

  it("inherits language from the source branch", async () => {
    const { db, branchInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ language: "sv" })
    );
  });

  it("falls back to 'en' language when source branch has no language", async () => {
    vi.mocked(readTreeContent).mockResolvedValueOnce({ ...DEFAULT_CONTENT, language: null as unknown as string } as never);
    const { db, branchInsertValues } = buildDbMock();

    await forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
  });

  it("forks without copying separate branch-assignment rows", async () => {
    const { db } = buildDbMock();

    await expect(
      forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).resolves.toMatchObject({ id: NEW_BRANCH_ID, forkedFromCommitId: COMMIT_ID });
  });

  it("still succeeds when the source snapshot has no assignments", async () => {
    vi.mocked(readTreeContent).mockResolvedValueOnce({ ...DEFAULT_CONTENT, assignments: [] } as never);
    const { db } = buildDbMock();

    await expect(
      forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).resolves.toMatchObject({ id: NEW_BRANCH_ID });
  });

  it("throws NOT_FOUND when commit does not exist", async () => {
    const { db } = buildDbMock({ commitRow: null });

    await expect(
      forkResumeBranch(db, MOCK_ADMIN, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fork their own resume's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      forkResumeBranch(db, MOCK_CONSULTANT, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant tries to fork another employee's resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      forkResumeBranch(db, MOCK_CONSULTANT_2, { fromCommitId: COMMIT_ID, name: "Fork" })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createForkResumeBranchHandler", () => {
  it("calls forkResumeBranch with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createForkResumeBranchHandler(db);

    const result = await call(
      handler,
      { fromCommitId: COMMIT_ID, name: "Swedish Variant" },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(NEW_BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createForkResumeBranchHandler(db);

    await expect(
      call(handler, { fromCommitId: COMMIT_ID, name: "Fork" }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
