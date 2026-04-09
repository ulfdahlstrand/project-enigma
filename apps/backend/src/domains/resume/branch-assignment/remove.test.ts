import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { removeBranchAssignment, createRemoveBranchAssignmentHandler } from "./remove.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";

vi.mock("../lib/branch-assignment-content.js", () => ({
  readBranchAssignmentContent: vi.fn(),
}));

vi.mock("../lib/upsert-branch-content-from-live.js", () => ({
  upsertBranchContentFromLive: vi.fn().mockResolvedValue(undefined),
}));

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440061";

function buildBranch(employeeId = EMPLOYEE_ID_1, assignments = [ASSIGNMENT_ID]) {
  return {
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: {
      assignments: assignments.map((assignmentId) => ({
        assignmentId,
        clientName: "Acme",
        role: "Engineer",
        description: "",
        startDate: "2023-01-01",
        endDate: null,
        technologies: [],
        isCurrent: false,
        keywords: null,
        type: null,
        highlight: false,
        sortOrder: null,
      })),
    },
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

describe("removeBranchAssignment", () => {
  it("removes the assignment from branch content and returns deleted: true", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const result = await removeBranchAssignment(db, MOCK_ADMIN, { id: ASSIGNMENT_ID, branchId: BRANCH_ID });
    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ assignments: [] }));
    expect(result).toEqual({ deleted: true });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch(EMPLOYEE_ID_1, []) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(removeBranchAssignment(db, MOCK_ADMIN, { id: ASSIGNMENT_ID, branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("consultant can remove from their own branch", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_1);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(removeBranchAssignment(db, MOCK_CONSULTANT, { id: ASSIGNMENT_ID, branchId: BRANCH_ID })).resolves.toEqual({ deleted: true });
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_2);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(removeBranchAssignment(db, MOCK_CONSULTANT_2, { id: ASSIGNMENT_ID, branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createRemoveBranchAssignmentHandler", () => {
  it("calls removeBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const handler = createRemoveBranchAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGNMENT_ID, branchId: BRANCH_ID }, { context: { user: MOCK_ADMIN } });
    expect(result).toEqual({ deleted: true });
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createRemoveBranchAssignmentHandler(db);
    await expect(call(handler, { id: ASSIGNMENT_ID, branchId: BRANCH_ID }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
