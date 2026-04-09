import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { updateBranchAssignment, createUpdateBranchAssignmentHandler } from "./update.js";
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
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

function buildBranch(employeeId = EMPLOYEE_ID_1, includeAssignment = true) {
  return {
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: {
      assignments: includeAssignment ? [{
        assignmentId: ASSIGNMENT_ID,
        clientName: "Acme Corp",
        role: "Developer",
        description: "",
        startDate: "2023-01-01",
        endDate: null,
        technologies: [],
        isCurrent: false,
        keywords: null,
        type: null,
        highlight: false,
        sortOrder: null,
      }] : [],
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

describe("updateBranchAssignment", () => {
  it("updates highlight and sortOrder, returns updated row", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);

    const result = await updateBranchAssignment(db, MOCK_ADMIN, {
      id: ASSIGNMENT_ID,
      branchId: BRANCH_ID,
      highlight: true,
      sortOrder: 3,
    });

    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        assignments: expect.arrayContaining([
          expect.objectContaining({ assignmentId: ASSIGNMENT_ID, highlight: true, sortOrder: 3 }),
        ]),
      }),
    );
    expect(result).toMatchObject({ id: ASSIGNMENT_ID, assignmentId: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true, sortOrder: 3 });
  });

  it("only includes provided fields in the update", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await updateBranchAssignment(db, MOCK_ADMIN, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: false });
    const args = vi.mocked(upsertBranchContentFromLive).mock.calls[0]?.[1] as { assignments: Array<{ highlight: boolean; sortOrder: number | null }> };
    expect(args.assignments[0]?.highlight).toBe(false);
    expect(args.assignments[0]?.sortOrder).toBeNull();
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch(EMPLOYEE_ID_1, false) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(updateBranchAssignment(db, MOCK_ADMIN, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("consultant can update their own branch assignment", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_1);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(updateBranchAssignment(db, MOCK_CONSULTANT, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true })).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_2);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(updateBranchAssignment(db, MOCK_CONSULTANT_2, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createUpdateBranchAssignmentHandler", () => {
  it("calls updateBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const handler = createUpdateBranchAssignmentHandler(db);
    const result = await call(handler, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true }, { context: { user: MOCK_ADMIN } });
    expect(result.id).toBe(ASSIGNMENT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createUpdateBranchAssignmentHandler(db);
    await expect(call(handler, { id: ASSIGNMENT_ID, branchId: BRANCH_ID, highlight: true }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
