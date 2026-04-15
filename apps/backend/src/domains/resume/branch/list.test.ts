import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listResumeBranches, createListResumeBranchesHandler } from "./list.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID_1 = "550e8400-e29b-41d4-a716-446655440031";
const BRANCH_ID_2 = "550e8400-e29b-41d4-a716-446655440032";
const BRANCH_ID_3 = "550e8400-e29b-41d4-a716-446655440033";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
const COMMIT_ID_2 = "550e8400-e29b-41d4-a716-446655440042";
const COMMIT_ID_3 = "550e8400-e29b-41d4-a716-446655440043";
const COMMIT_ID_4 = "550e8400-e29b-41d4-a716-446655440044";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const RESUME_ROW = { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 };

const BRANCH_ROW_1 = {
  id: BRANCH_ID_1,
  resume_id: RESUME_ID,
  name: "main",
  language: "en",
  is_main: true,
  head_commit_id: COMMIT_ID,
  forked_from_commit_id: null,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
};

const BRANCH_ROW_2 = {
  id: BRANCH_ID_2,
  resume_id: RESUME_ID,
  name: "Swedish Variant",
  language: "sv",
  is_main: false,
  head_commit_id: COMMIT_ID_2,
  forked_from_commit_id: COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
};

const BRANCH_ROW_3 = {
  id: BRANCH_ID_3,
  resume_id: RESUME_ID,
  name: "Merged Variant",
  language: "sv",
  is_main: false,
  head_commit_id: COMMIT_ID_3,
  forked_from_commit_id: COMMIT_ID,
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-03T00:00:00.000Z"),
  branch_type: "variant" as const,
  source_branch_id: null,
  source_commit_id: null,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  resumeRow?: unknown;
  branchRows?: unknown[];
  employeeId?: string | null;
  edgeRows?: unknown[];
} = {}) {
  const {
    resumeRow = RESUME_ROW,
    branchRows = [BRANCH_ROW_1, BRANCH_ROW_2],
    employeeId = null,
    edgeRows = [],
  } = opts;

  const resolvedResume = resumeRow === null ? undefined : resumeRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Resume ownership check
  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });

  // Branch list query
  const branchExecute = vi.fn().mockResolvedValue(branchRows);
  const branchOrderBy = vi.fn().mockReturnValue({ execute: branchExecute });
  const branchWhere = vi.fn().mockReturnValue({ orderBy: branchOrderBy });
  const branchSelectAll = vi.fn().mockReturnValue({ where: branchWhere });

  const edgeExecute = vi.fn().mockResolvedValue(edgeRows);
  const edgeWhere = vi.fn().mockReturnValue({ execute: edgeExecute });
  const edgeSelect = vi.fn().mockReturnValue({ where: edgeWhere });
  const edgeInnerJoin = vi.fn().mockReturnValue({ select: edgeSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_branches") return { selectAll: branchSelectAll };
    if (table === "resume_commit_parents as rcp") return { innerJoin: edgeInnerJoin };
    // resumes table
    return { select: resumeSelect };
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listResumeBranches", () => {
  it("returns all branches for a resume with branch type fields", async () => {
    const { db } = buildDbMock();

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: BRANCH_ID_1,
      resumeId: RESUME_ID,
      name: "main",
      language: "en",
      isMain: true,
      headCommitId: COMMIT_ID,
      forkedFromCommitId: null,
      branchType: "variant",
      sourceBranchId: null,
      sourceCommitId: null,
      isStale: false,
    });
    expect(result[1]).toMatchObject({
      id: BRANCH_ID_2,
      name: "Swedish Variant",
      isMain: false,
      branchType: "variant",
      isStale: false,
    });
  });

  it("marks a translation branch as stale when source has advanced", async () => {
    const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440050";
    const TRANSLATION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440060";

    const { db } = buildDbMock({
      branchRows: [
        BRANCH_ROW_1,
        {
          id: TRANSLATION_BRANCH_ID,
          resume_id: RESUME_ID,
          name: "main-en",
          language: "en",
          is_main: false,
          head_commit_id: SOURCE_COMMIT_ID,
          forked_from_commit_id: SOURCE_COMMIT_ID,
          created_by: CREATOR_ID,
          created_at: new Date("2026-01-04T00:00:00.000Z"),
          branch_type: "translation" as const,
          source_branch_id: BRANCH_ID_1,
          // source_commit_id points to old commit, source variant has advanced to COMMIT_ID
          source_commit_id: SOURCE_COMMIT_ID,
        },
      ],
    });

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    const translation = result.find((b) => b.id === TRANSLATION_BRANCH_ID);
    expect(translation).toBeDefined();
    expect(translation?.isStale).toBe(true);
  });

  it("marks a translation branch as not stale when caught up to source HEAD", async () => {
    const TRANSLATION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440060";

    const { db } = buildDbMock({
      branchRows: [
        BRANCH_ROW_1,
        {
          id: TRANSLATION_BRANCH_ID,
          resume_id: RESUME_ID,
          name: "main-en",
          language: "en",
          is_main: false,
          head_commit_id: COMMIT_ID,
          forked_from_commit_id: COMMIT_ID,
          created_by: CREATOR_ID,
          created_at: new Date("2026-01-04T00:00:00.000Z"),
          branch_type: "translation" as const,
          source_branch_id: BRANCH_ID_1,
          // source_commit_id matches source variant's head_commit_id (COMMIT_ID)
          source_commit_id: COMMIT_ID,
        },
      ],
    });

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    const translation = result.find((b) => b.id === TRANSLATION_BRANCH_ID);
    expect(translation?.isStale).toBe(false);
  });

  it("filters out merged branches whose head commit is already reachable from main", async () => {
    const { db } = buildDbMock({
      branchRows: [
        { ...BRANCH_ROW_1, head_commit_id: COMMIT_ID_4 },
        BRANCH_ROW_2,
        BRANCH_ROW_3,
      ],
      edgeRows: [
        { commitId: COMMIT_ID_4, parentCommitId: COMMIT_ID },
        { commitId: COMMIT_ID_4, parentCommitId: COMMIT_ID_3 },
        { commitId: COMMIT_ID_3, parentCommitId: COMMIT_ID },
      ],
    });

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result.map((branch) => branch.id)).toEqual([BRANCH_ID_1, BRANCH_ID_2]);
  });

  it("returns empty array when resume has no branches", async () => {
    const { db } = buildDbMock({ branchRows: [] });

    const result = await listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toEqual([]);
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock({ resumeRow: null });

    await expect(
      listResumeBranches(db, MOCK_ADMIN, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can list branches for their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      listResumeBranches(db, MOCK_CONSULTANT, { resumeId: RESUME_ID })
    ).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      listResumeBranches(db, MOCK_CONSULTANT_2, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createListResumeBranchesHandler", () => {
  it("calls listResumeBranches with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeBranchesHandler(db);

    const result = await call(handler, { resumeId: RESUME_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeBranchesHandler(db);

    await expect(
      call(handler, { resumeId: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
