import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { listResumeCommits, createListResumeCommitsHandler } from "./list-resume-commits.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
// Valid v4 UUIDs for commit IDs and creator (Zod v4 requires version nibble 1-8)
const COMMIT_ID_1 = "550e8400-e29b-41d4-a716-446655440061";
const COMMIT_ID_2 = "550e8400-e29b-41d4-a716-446655440062";
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const COMMIT_ROWS = [
  {
    id: COMMIT_ID_2,
    resume_id: RESUME_ID,
    branch_id: BRANCH_ID,
    parent_commit_id: COMMIT_ID_1,
    message: "Updated skills",
    created_by: CREATOR_ID,
    created_at: new Date("2026-02-01T00:00:00.000Z"),
  },
  {
    id: COMMIT_ID_1,
    resume_id: RESUME_ID,
    branch_id: BRANCH_ID,
    parent_commit_id: null,
    message: "Initial version",
    created_by: CREATOR_ID,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
  },
];

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

const DEFAULT_BRANCH_ROW = { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 };

function buildDbMock(opts: {
  branchRow?: unknown;
  commitRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const { branchRow = DEFAULT_BRANCH_ROW, commitRows = COMMIT_ROWS, employeeId = null } = opts;
  // null sentinel → Kysely "not found" (executeTakeFirst returns undefined)
  const resolvedBranch = branchRow === null ? undefined : branchRow;
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Branch lookup
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  // Commits query
  const commitsExecute = vi.fn().mockResolvedValue(commitRows);
  const commitsOrderBy = vi.fn().mockReturnValue({ execute: commitsExecute });
  const commitsWhere = vi.fn().mockReturnValue({ orderBy: commitsOrderBy });
  const commitsSelect = vi.fn().mockReturnValue({ where: commitsWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_commits") return { select: commitsSelect };
    return { innerJoin: branchInnerJoin };
  });

  return { db: { selectFrom } as unknown as Kysely<Database>, commitsOrderBy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listResumeCommits", () => {
  it("returns commits in reverse chronological order for admin", async () => {
    const { db, commitsOrderBy } = buildDbMock();

    const result = await listResumeCommits(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: COMMIT_ID_2, message: "Updated skills" });
    expect(result[1]).toMatchObject({ id: COMMIT_ID_1, message: "Initial version" });
    expect(commitsOrderBy).toHaveBeenCalledWith("created_at", "desc");
  });

  it("returns empty array when branch has no commits", async () => {
    const { db } = buildDbMock({ commitRows: [] });

    const result = await listResumeCommits(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result).toEqual([]);
  });

  it("does not include content in the summary", async () => {
    const { db } = buildDbMock();

    const result = await listResumeCommits(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect((result[0] as Record<string, unknown>).content).toBeUndefined();
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      listResumeCommits(db, MOCK_ADMIN, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can list commits on their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      listResumeCommits(db, MOCK_CONSULTANT, { branchId: BRANCH_ID })
    ).resolves.toHaveLength(2);
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      listResumeCommits(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });
});

describe("createListResumeCommitsHandler", () => {
  it("returns commits for authenticated admin", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeCommitsHandler(db);

    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });

    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListResumeCommitsHandler(db);

    await expect(
      call(handler, { branchId: BRANCH_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
