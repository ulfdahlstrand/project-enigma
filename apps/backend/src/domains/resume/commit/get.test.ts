import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getResumeCommit, createGetResumeCommitHandler } from "./get.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";
// Valid v4 UUID (Zod v4 requires version nibble 1-8 and variant bits)
const CREATOR_ID = "550e8400-e29b-41d4-a716-446655440099";

const COMMIT_ROW = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  branch_id: BRANCH_ID,
  parent_commit_id: null,
  content: { title: "Engineer", skills: [], assignments: [], language: "en", presentation: [], summary: null, consultantTitle: null },
  message: "Initial version",
  title: "Initial version",
  description: "",
  created_by: CREATOR_ID,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  employee_id: EMPLOYEE_ID_1,
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: { commitRow?: unknown; employeeId?: string | null } = {}) {
  const { commitRow = COMMIT_ROW, employeeId = null } = opts;
  // null sentinel → Kysely "not found" (executeTakeFirst returns undefined)
  const resolvedCommit = commitRow === null ? undefined : commitRow;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const commitExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedCommit);
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const commitInnerJoin = vi.fn().mockReturnValue({ select: commitSelect });
  const commitLeftJoin = vi.fn().mockReturnValue({ innerJoin: commitInnerJoin });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return { leftJoin: commitLeftJoin };
  });

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getResumeCommit", () => {
  it("returns the full commit including content for admin", async () => {
    const { db } = buildDbMock();

    const result = await getResumeCommit(db, MOCK_ADMIN, { commitId: COMMIT_ID });

    expect(result).toMatchObject({
      id: COMMIT_ID,
      resumeId: RESUME_ID,
      branchId: BRANCH_ID,
      parentCommitId: null,
      message: "Initial version",
    });
    expect(result.content).toBeDefined();
  });

  it("throws NOT_FOUND when commit does not exist", async () => {
    const { db } = buildDbMock({ commitRow: null });

    await expect(
      getResumeCommit(db, MOCK_ADMIN, { commitId: COMMIT_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("consultant can fetch a commit on their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(
      getResumeCommit(db, MOCK_CONSULTANT, { commitId: COMMIT_ID })
    ).resolves.toMatchObject({ id: COMMIT_ID });
  });

  it("throws FORBIDDEN when consultant fetches another employee's commit", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(
      getResumeCommit(db, MOCK_CONSULTANT_2, { commitId: COMMIT_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("normalises invalid legacy assignment fields in commit content", async () => {
    const { db } = buildDbMock({
      commitRow: {
        ...COMMIT_ROW,
        content: {
          ...COMMIT_ROW.content,
          assignments: [
            {
              assignmentId: "550e8400-e29b-41d4-a716-446655440055",
              clientName: "Legacy Co",
              role: "Consultant",
              description: "Legacy description",
              startDate: "2024-01-01",
              endDate: undefined,
              technologies: undefined,
              isCurrent: false,
              keywords: undefined,
              type: undefined,
              highlight: undefined,
              sortOrder: undefined,
            },
          ],
        },
      },
    });

    const result = await getResumeCommit(db, MOCK_ADMIN, { commitId: COMMIT_ID });

    expect(result.content.assignments[0]).toMatchObject({
      endDate: null,
      technologies: [],
      keywords: null,
      type: null,
      highlight: false,
      sortOrder: null,
    });
  });
});

describe("createGetResumeCommitHandler", () => {
  it("returns commit for authenticated admin", async () => {
    const { db } = buildDbMock();
    const handler = createGetResumeCommitHandler(db);

    const result = await call(handler, { commitId: COMMIT_ID }, { context: { user: MOCK_ADMIN } });

    expect(result.id).toBe(COMMIT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createGetResumeCommitHandler(db);

    await expect(
      call(handler, { commitId: COMMIT_ID }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
