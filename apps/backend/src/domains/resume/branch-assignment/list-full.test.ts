import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listBranchAssignmentsFull, createListBranchAssignmentsFullHandler } from "./list-full.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";

vi.mock("../lib/branch-assignment-content.js", () => ({
  readBranchAssignmentContent: vi.fn(),
}));

const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440001";
const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440002";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440009";
const USER = { id: "550e8400-e29b-41d4-a716-446655440099", role: "admin" as const, email: "a@example.com" };

function buildAssignments() {
  return [{
    assignmentId: "550e8400-e29b-41d4-a716-446655440020",
    clientName: "ACME",
    role: "Engineer",
    description: "Built things",
    startDate: "2023-01-01",
    endDate: null,
    technologies: ["TypeScript"],
    isCurrent: true,
    keywords: null,
    type: null,
    highlight: true,
    sortOrder: 0,
  }, {
    assignmentId: "550e8400-e29b-41d4-a716-446655440021",
    clientName: "Globex",
    role: "Consultant",
    description: "",
    startDate: "2022-01-01",
    endDate: "2022-12-31",
    technologies: [],
    isCurrent: false,
    keywords: null,
    type: null,
    highlight: false,
    sortOrder: 1,
  }];
}

function buildBranch(assignments = buildAssignments(), employeeId = EMPLOYEE_ID) {
  return {
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: { assignments },
  };
}

function buildDb(employeeId: string | null = null) {
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });
  return { selectFrom: vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    throw new Error(`Unexpected table: ${table}`);
  }) } as unknown as Kysely<Database>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listBranchAssignmentsFull", () => {
  it("returns full assignment data for all linked assignments", async () => {
    const db = buildDb();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const result = await listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ clientName: "ACME", role: "Engineer", isCurrent: true, highlight: true, sortOrder: 0 });
    expect(result[1]).toMatchObject({ clientName: "Globex", isCurrent: false, sortOrder: 1 });
  });

  it("returns empty array when branch has no assignments", async () => {
    const db = buildDb();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([]) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID })).resolves.toHaveLength(0);
  });

  it("maps content fields to camelCase output", async () => {
    const db = buildDb();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const result = await listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID });
    expect(result[0]).toHaveProperty("clientName");
    expect(result[0]).toHaveProperty("isCurrent");
    expect(result[0]).not.toHaveProperty("client_name");
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const db = buildDb();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(null);
    await expect(listBranchAssignmentsFull(db, USER, { branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const consultant = { id: "550e8400-e29b-41d4-a716-446655440088", role: "consultant" as const, email: "c@example.com" };
    const db = buildDb(EMPLOYEE_ID_2);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch([], EMPLOYEE_ID) as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    await expect(listBranchAssignmentsFull(db, consultant, { branchId: BRANCH_ID })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN",
    );
  });
});

describe("createListBranchAssignmentsFullHandler", () => {
  it("returns assignments when authenticated", async () => {
    const db = buildDb();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>);
    const handler = createListBranchAssignmentsFullHandler(db);
    const result = await call(handler, { branchId: BRANCH_ID }, { context: { user: USER } });
    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb();
    const handler = createListBranchAssignmentsFullHandler(db);
    await expect(call(handler, { branchId: BRANCH_ID }, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
