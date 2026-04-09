import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listBranchAssignments, createListBranchAssignmentsHandler } from "./list.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";

vi.mock("../lib/branch-assignment-content.js", () => ({
  readBranchAssignmentContent: vi.fn(),
}));

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

function buildBranch(assignments: unknown[] = []) {
  return {
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId: EMPLOYEE_ID_1,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: { assignments },
  };
}

function buildDbMock(employeeId: string | null = null) {
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });
  return { db: { selectFrom: vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    throw new Error(`Unexpected table: ${table}`);
  }) } as unknown as Kysely<Database> };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listBranchAssignments", () => {
  it("returns all assignments linked to the branch", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([{
      assignmentId: ASSIGNMENT_ID,
      highlight: true,
      sortOrder: 0,
    }]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);

    const result = await listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID });

    expect(result).toEqual([{
      id: ASSIGNMENT_ID,
      branchId: BRANCH_ID,
      assignmentId: ASSIGNMENT_ID,
      highlight: true,
      sortOrder: 0,
    }]);
  });

  it("returns empty array when no assignments are linked", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID })).resolves.toEqual([]);
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(null);
    await expect(listBranchAssignments(db, MOCK_ADMIN, { branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("consultant can list their own branch assignments", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_1);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(listBranchAssignments(db, MOCK_CONSULTANT, { branchId: BRANCH_ID })).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_2);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(listBranchAssignments(db, MOCK_CONSULTANT_2, { branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createListBranchAssignmentsHandler", () => {
  it("calls listBranchAssignments with authenticated user", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const handler = createListBranchAssignmentsHandler(db);
    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });
    expect(result).toEqual([]);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createListBranchAssignmentsHandler(db);
    await expect(call(handler, { branchId: BRANCH_ID }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
