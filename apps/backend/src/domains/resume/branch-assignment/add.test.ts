import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { addBranchAssignment, createAddBranchAssignmentHandler } from "./add.js";
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

const BRANCH_ROW = {
  branchId: BRANCH_ID,
  resumeId: "resume-1",
  employeeId: EMPLOYEE_ID_1,
  title: "Resume",
  language: "en",
  createdAt: new Date("2023-01-01"),
  content: { assignments: [] },
};

const ASSIGNMENT_ROW = { employee_id: EMPLOYEE_ID_1 };

const VALID_INPUT = {
  branchId: BRANCH_ID,
  assignmentId: ASSIGNMENT_ID,
  clientName: "Acme Corp",
  role: "Developer",
  startDate: "2023-01-01",
};

function buildDbMock(opts: {
  branchRow?: unknown;
  assignmentRow?: unknown;
  employeeId?: string | null;
} = {}) {
  const {
    branchRow = BRANCH_ROW,
    assignmentRow = ASSIGNMENT_ROW,
    employeeId = null,
  } = opts;

  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const assignmentExecuteTakeFirst = vi.fn().mockResolvedValue(assignmentRow === null ? undefined : assignmentRow);
  const assignmentWhere2 = vi.fn().mockReturnValue({ executeTakeFirst: assignmentExecuteTakeFirst });
  const assignmentWhere1 = vi.fn().mockReturnValue({ where: assignmentWhere2 });
  const assignmentSelect = vi.fn().mockReturnValue({ where: assignmentWhere1 });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "assignments") return { select: assignmentSelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(readBranchAssignmentContent).mockResolvedValue(
    branchRow === null ? null : branchRow as Awaited<ReturnType<typeof readBranchAssignmentContent>>,
  );

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addBranchAssignment", () => {
  it("appends the new assignment to branch content and returns it", async () => {
    const { db } = buildDbMock();

    const result = await addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT);

    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        branchId: BRANCH_ID,
        assignments: expect.arrayContaining([
          expect.objectContaining({
            assignmentId: ASSIGNMENT_ID,
            clientName: "Acme Corp",
            highlight: false,
          }),
        ]),
      }),
    );
    expect(result.id).toBe(ASSIGNMENT_ID);
    expect(result.branchId).toBe(BRANCH_ID);
    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
  });

  it("respects provided highlight and sortOrder values", async () => {
    const { db } = buildDbMock();

    await addBranchAssignment(db, MOCK_ADMIN, { ...VALID_INPUT, highlight: true, sortOrder: 5 });

    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        assignments: expect.arrayContaining([
          expect.objectContaining({ highlight: true, sortOrder: 5 }),
        ]),
      }),
    );
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const { db } = buildDbMock({ assignmentRow: null });

    await expect(addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws FORBIDDEN when assignment belongs to a different employee", async () => {
    const { db } = buildDbMock({ assignmentRow: { employee_id: EMPLOYEE_ID_2 } });

    await expect(addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(addBranchAssignment(db, MOCK_ADMIN, VALID_INPUT)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("consultant can add to their own branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1 });

    await expect(addBranchAssignment(db, MOCK_CONSULTANT, VALID_INPUT)).resolves.toBeDefined();
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2 });

    await expect(addBranchAssignment(db, MOCK_CONSULTANT_2, VALID_INPUT)).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createAddBranchAssignmentHandler", () => {
  it("calls addBranchAssignment with authenticated user", async () => {
    const { db } = buildDbMock();
    const handler = createAddBranchAssignmentHandler(db);

    const result = await call(handler, VALID_INPUT, { context: { user: MOCK_ADMIN } });

    expect(result.id).toBe(ASSIGNMENT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createAddBranchAssignmentHandler(db);

    await expect(call(handler, VALID_INPUT, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
