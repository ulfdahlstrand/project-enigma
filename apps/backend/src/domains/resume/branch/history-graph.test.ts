import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  getResumeBranchHistoryGraph,
  createGetResumeBranchHistoryGraphHandler,
} from "./history-graph.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const MAIN_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const SV_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const MAIN_COMMIT_ID_1 = "550e8400-e29b-41d4-a716-446655440041";
const MAIN_COMMIT_ID_2 = "550e8400-e29b-41d4-a716-446655440042";
const SV_COMMIT_ID_1 = "550e8400-e29b-41d4-a716-446655440043";
const MERGE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440044";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const RESUME_ROW = { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 };

const BRANCH_ROWS = [
  {
    id: MAIN_BRANCH_ID,
    resume_id: RESUME_ID,
    name: "main",
    language: "en",
    is_main: true,
    head_commit_id: MERGE_COMMIT_ID,
    forked_from_commit_id: null,
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    branch_type: "variant" as const,
    source_branch_id: null,
    source_commit_id: null,
    is_archived: false,
  },
  {
    id: SV_BRANCH_ID,
    resume_id: RESUME_ID,
    name: "Swedish Variant",
    language: "sv",
    is_main: false,
    head_commit_id: SV_COMMIT_ID_1,
    forked_from_commit_id: MAIN_COMMIT_ID_1,
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-02T00:00:00.000Z"),
    branch_type: "variant" as const,
    source_branch_id: null,
    source_commit_id: null,
    is_archived: false,
  },
];

const COMMIT_ROWS = [
  {
    id: MAIN_COMMIT_ID_1,
    resume_id: RESUME_ID,
    branch_id: MAIN_BRANCH_ID,
    parent_commit_id: null,
    message: "Initial version",
    title: "Initial version",
    description: "",
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: MAIN_COMMIT_ID_2,
    resume_id: RESUME_ID,
    branch_id: MAIN_BRANCH_ID,
    parent_commit_id: MAIN_COMMIT_ID_1,
    message: "Updated skills",
    title: "Updated skills",
    description: "",
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-03T00:00:00.000Z"),
  },
  {
    id: MERGE_COMMIT_ID,
    resume_id: RESUME_ID,
    branch_id: MAIN_BRANCH_ID,
    parent_commit_id: MAIN_COMMIT_ID_2,
    message: "Merge revision workflow",
    title: "Merge revision workflow",
    description: "",
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-05T00:00:00.000Z"),
  },
  {
    id: SV_COMMIT_ID_1,
    resume_id: RESUME_ID,
    branch_id: SV_BRANCH_ID,
    parent_commit_id: MAIN_COMMIT_ID_1,
    message: "Swedish version",
    title: "Swedish version",
    description: "",
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-04T00:00:00.000Z"),
  },
];

const COMMIT_PARENT_ROWS = [
  {
    commit_id: MAIN_COMMIT_ID_2,
    parent_commit_id: MAIN_COMMIT_ID_1,
    parent_order: 0,
  },
  {
    commit_id: MERGE_COMMIT_ID,
    parent_commit_id: MAIN_COMMIT_ID_2,
    parent_order: 0,
  },
  {
    commit_id: MERGE_COMMIT_ID,
    parent_commit_id: SV_COMMIT_ID_1,
    parent_order: 1,
  },
  {
    commit_id: SV_COMMIT_ID_1,
    parent_commit_id: MAIN_COMMIT_ID_1,
    parent_order: 0,
  },
];

function buildDbMock(opts: {
  resumeRow?: unknown;
  branchRows?: unknown[];
  commitRows?: unknown[];
  commitParentRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    resumeRow = RESUME_ROW,
    branchRows = BRANCH_ROWS,
    commitRows = COMMIT_ROWS,
    commitParentRows = COMMIT_PARENT_ROWS,
    employeeId = null,
  } = opts;

  const resolvedResume = resumeRow === null ? undefined : resumeRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });

  const branchExecute = vi.fn().mockResolvedValue(branchRows);
  const branchOrderBy = vi.fn().mockReturnValue({ execute: branchExecute });
  const branchWhere = vi.fn().mockReturnValue({ orderBy: branchOrderBy });
  const branchSelectAll = vi.fn().mockReturnValue({ where: branchWhere });

  const commitExecute = vi.fn().mockResolvedValue(commitRows);
  const commitOrderBy = vi.fn().mockReturnValue({ execute: commitExecute });
  const commitWhere = vi.fn().mockReturnValue({ orderBy: commitOrderBy });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitLeftJoin = vi.fn().mockImplementation(() => ({ select: commitSelect }));
  const edgeExecute = vi.fn().mockResolvedValue(commitParentRows);
  const edgeOrderBySecond = vi.fn().mockReturnValue({ execute: edgeExecute });
  const edgeOrderByFirst = vi.fn().mockReturnValue({ orderBy: edgeOrderBySecond });
  const edgeWhere = vi.fn().mockReturnValue({ orderBy: edgeOrderByFirst });
  const edgeSelect = vi.fn().mockReturnValue({ where: edgeWhere });
  const edgeInnerJoin = vi.fn().mockReturnValue({ select: edgeSelect });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_branches") return { selectAll: branchSelectAll };
    if (table === "resume_commits") return { leftJoin: commitLeftJoin };
    if (table === "resume_commit_parents as rcp") return { innerJoin: edgeInnerJoin };
    return { select: resumeSelect };
  });

  return { db: { selectFrom } as unknown as Kysely<Database>, branchOrderBy, commitOrderBy };
}

describe("getResumeBranchHistoryGraph", () => {
  it("returns all branches and commits for a resume graph", async () => {
    const { db, branchOrderBy, commitOrderBy } = buildDbMock();

    const result = await getResumeBranchHistoryGraph(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result.branches).toHaveLength(2);
    expect(result.commits).toHaveLength(4);
    expect(result.edges).toContainEqual({
      commitId: MERGE_COMMIT_ID,
      parentCommitId: SV_COMMIT_ID_1,
      parentOrder: 1,
    });
    expect(result.branches[0]).toMatchObject({
      id: MAIN_BRANCH_ID,
      headCommitId: MERGE_COMMIT_ID,
      forkedFromCommitId: null,
    });
    expect(result.branches[1]).toMatchObject({
      id: SV_BRANCH_ID,
      forkedFromCommitId: MAIN_COMMIT_ID_1,
      headCommitId: SV_COMMIT_ID_1,
    });
    expect(result.commits[3]).toMatchObject({
      id: SV_COMMIT_ID_1,
      parentCommitId: MAIN_COMMIT_ID_1,
    });
    expect(branchOrderBy).toHaveBeenCalledWith("resume_branches.created_at", "asc");
    expect(commitOrderBy).toHaveBeenCalledWith("resume_commits.created_at", "asc");
  });

  it("returns empty arrays when a resume has no branches or commits", async () => {
    const { db } = buildDbMock({ branchRows: [], commitRows: [], commitParentRows: [] });

    const result = await getResumeBranchHistoryGraph(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toEqual({ branches: [], commits: [], edges: [] });
  });

  it("filters out commits that are not attached to an existing branch", async () => {
    const orphanCommitId = "550e8400-e29b-41d4-a716-446655440045";
    const { db } = buildDbMock({
      commitRows: [
        ...COMMIT_ROWS,
        {
          id: orphanCommitId,
          resume_id: RESUME_ID,
          branch_id: null,
          parent_commit_id: MAIN_COMMIT_ID_2,
          message: "Orphan commit",
          title: "Orphan commit",
          description: "",
          created_by: CREATOR_ID,
          created_at: new Date("2026-01-06T00:00:00.000Z"),
        },
      ],
      commitParentRows: [
        ...COMMIT_PARENT_ROWS,
        {
          commit_id: orphanCommitId,
          parent_commit_id: MAIN_COMMIT_ID_2,
          parent_order: 0,
        },
      ],
    });

    const result = await getResumeBranchHistoryGraph(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result.commits.map((commit) => commit.id)).not.toContain(orphanCommitId);
    expect(result.edges.some((edge) => edge.commitId === orphanCommitId)).toBe(false);
  });

  it("preserves reachable merged commits even when their source branch is no longer active", async () => {
    const mergedCommitId = "550e8400-e29b-41d4-a716-446655440045";
    const { db } = buildDbMock({
      branchRows: [BRANCH_ROWS[0]!],
      commitRows: [
        ...COMMIT_ROWS,
        {
          id: mergedCommitId,
          resume_id: RESUME_ID,
          branch_id: SV_BRANCH_ID,
          parent_commit_id: MAIN_COMMIT_ID_1,
          message: "Merged branch work",
          title: "Merged branch work",
          description: "",
          created_by: CREATOR_ID,
          created_at: new Date("2026-01-04T12:00:00.000Z"),
        },
        {
          id: MERGE_COMMIT_ID,
          resume_id: RESUME_ID,
          branch_id: MAIN_BRANCH_ID,
          parent_commit_id: MAIN_COMMIT_ID_2,
          message: "Merge revision workflow",
          title: "Merge revision workflow",
          description: "",
          created_by: CREATOR_ID,
          created_at: new Date("2026-01-05T00:00:00.000Z"),
        },
      ],
      commitParentRows: [
        {
          commit_id: MAIN_COMMIT_ID_2,
          parent_commit_id: MAIN_COMMIT_ID_1,
          parent_order: 0,
        },
        {
          commit_id: mergedCommitId,
          parent_commit_id: MAIN_COMMIT_ID_1,
          parent_order: 0,
        },
        {
          commit_id: MERGE_COMMIT_ID,
          parent_commit_id: MAIN_COMMIT_ID_2,
          parent_order: 0,
        },
        {
          commit_id: MERGE_COMMIT_ID,
          parent_commit_id: mergedCommitId,
          parent_order: 1,
        },
      ],
    });

    const result = await getResumeBranchHistoryGraph(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result.commits.map((commit) => commit.id)).toContain(mergedCommitId);
    expect(result.edges).toContainEqual({
      commitId: MERGE_COMMIT_ID,
      parentCommitId: mergedCommitId,
      parentOrder: 1,
    });
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock({ resumeRow: null });

    await expect(
      getResumeBranchHistoryGraph(db, MOCK_ADMIN, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can access their own resume graph", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      getResumeBranchHistoryGraph(db, MOCK_CONSULTANT, { resumeId: RESUME_ID })
    ).resolves.toMatchObject({ branches: expect.any(Array), commits: expect.any(Array) });
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      getResumeBranchHistoryGraph(db, MOCK_CONSULTANT_2, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createGetResumeBranchHistoryGraphHandler", () => {
  it("returns the graph for an authenticated admin", async () => {
    const { db } = buildDbMock();
    const handler = createGetResumeBranchHistoryGraphHandler(db);

    const result = await call(handler, { resumeId: RESUME_ID }, { context: { user: MOCK_ADMIN } });

    expect(result.branches).toHaveLength(2);
    expect(result.commits).toHaveLength(4);
    expect(result.edges).toHaveLength(4);
  });

  it("throws UNAUTHORIZED when no user is present in context", async () => {
    const { db } = buildDbMock();
    const handler = createGetResumeBranchHistoryGraphHandler(db);

    await expect(
      call(handler, { resumeId: RESUME_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
