import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createAssignment, createCreateAssignmentHandler } from "./create.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";

vi.mock("../lib/branch-assignment-content.js", () => ({
  readBranchAssignmentContent: vi.fn(),
}));

vi.mock("../lib/upsert-branch-content-from-live.js", () => ({
  upsertBranchContentFromLive: vi.fn().mockResolvedValue(undefined),
}));

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const VALID_INPUT = {
  employeeId: EMP_ID,
  branchId: BRANCH_ID,
  clientName: "Acme Corp",
  role: "Developer",
  description: "Built things",
  startDate: "2023-01-01",
  endDate: null,
  technologies: ["TypeScript"],
  isCurrent: false,
  keywords: null,
  type: null,
  highlight: false,
};

const IDENTITY_ROW = { id: ASSIGNMENT_ID, employee_id: EMP_ID, created_at: new Date("2023-01-01") };

function buildDb() {
  const identityExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(IDENTITY_ROW);
  const identityReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: identityExecuteTakeFirstOrThrow });
  const identityValues = vi.fn().mockReturnValue({ returningAll: identityReturningAll });
  const insertInto = vi.fn().mockReturnValue({ values: identityValues });
  const selectFrom = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ executeTakeFirst: vi.fn().mockResolvedValue(undefined) }) }) });
  const db = {
    selectFrom,
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => fn({ insertInto })),
    }),
  } as unknown as Kysely<Database>;

  vi.mocked(readBranchAssignmentContent).mockResolvedValue({
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId: EMP_ID,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: { assignments: [] },
  } as Awaited<ReturnType<typeof readBranchAssignmentContent>>);

  return { db, identityValues };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAssignment", () => {
  it("inserts identity and appends assignment to branch content in a transaction", async () => {
    const { db, identityValues } = buildDb();
    const result = await createAssignment(db, { id: "user-1", role: "admin", email: "a@example.com" }, VALID_INPUT);
    expect(identityValues).toHaveBeenCalledWith({ employee_id: EMP_ID });
    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        branchId: BRANCH_ID,
        assignments: expect.arrayContaining([
          expect.objectContaining({ assignmentId: ASSIGNMENT_ID, clientName: "Acme Corp" }),
        ]),
      }),
    );
    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
    expect(result.branchId).toBe(BRANCH_ID);
    expect(result.employeeId).toBe(EMP_ID);
  });

  it("returns full content fields from the new assignment content", async () => {
    const { db } = buildDb();
    const result = await createAssignment(db, { id: "user-1", role: "admin", email: "a@example.com" }, VALID_INPUT);
    expect(result.clientName).toBe("Acme Corp");
    expect(result.role).toBe("Developer");
    expect(result.technologies).toEqual(["TypeScript"]);
  });
});

describe("createCreateAssignmentHandler", () => {
  it("returns result when authenticated", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db);
    const result = await call(handler, VALID_INPUT, {
      context: { user: { id: "user-1", role: "admin", email: "a@example.com" } },
    });
    expect(result.assignmentId).toBeDefined();
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDb();
    const handler = createCreateAssignmentHandler(db);
    await expect(call(handler, VALID_INPUT, { context: {} })).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED",
    );
  });
});
