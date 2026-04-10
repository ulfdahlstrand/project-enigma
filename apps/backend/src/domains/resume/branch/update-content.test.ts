import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createUpdateResumeBranchContentHandler, updateResumeBranchContent } from "./update-content.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";

vi.mock("../lib/branch-assignment-content.js");
vi.mock("../lib/upsert-branch-content-from-live.js");
vi.mock("../../../auth/resolve-employee-id.js");

const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";

const BRANCH = {
  branchId: BRANCH_ID,
  resumeId: RESUME_ID,
  employeeId: EMPLOYEE_ID,
  title: "My Resume",
  language: "sv",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  content: {
    title: "My Resume",
    consultantTitle: "Senior Developer",
    presentation: ["Existing presentation"],
    summary: "Existing summary",
    highlightedItems: ["Existing highlight"],
    language: "sv",
    education: [],
    skillGroups: [],
    skills: [],
    assignments: [],
  },
};

function buildDb() {
  return {} as Kysely<Database>;
}

describe("updateResumeBranchContent", () => {
  beforeEach(() => {
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(BRANCH as never);
    vi.mocked(upsertBranchContentFromLive).mockResolvedValue({
      ...BRANCH.content,
      title: "Updated resume title",
      consultantTitle: "Updated consultant title",
      presentation: ["Updated presentation"],
      summary: "Updated summary",
      highlightedItems: ["Principal Engineer", "Tech Lead"],
      education: [{ type: "course", value: "Distributed Systems", sortOrder: 0 }],
    } as never);
    vi.mocked(resolveEmployeeId).mockResolvedValue(null);
  });

  it("updates branch-scoped scalar content", async () => {
    const result = await updateResumeBranchContent(buildDb(), MOCK_ADMIN, {
        branchId: BRANCH_ID,
        title: "Updated resume title",
        consultantTitle: "Updated consultant title",
        presentation: ["Updated presentation"],
        summary: "Updated summary",
        highlightedItems: [" Principal Engineer ", "", "Tech Lead "],
        education: [{ type: "course", value: " Distributed Systems ", sortOrder: 0 }],
      });

    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        branchId: BRANCH_ID,
        resumeId: RESUME_ID,
        title: "Updated resume title",
        consultantTitle: "Updated consultant title",
        presentation: ["Updated presentation"],
        summary: "Updated summary",
        highlightedItems: ["Principal Engineer", "Tech Lead"],
        education: [{ type: "course", value: "Distributed Systems", sortOrder: 0 }],
      }),
    );
    expect(result).toEqual({
      branchId: BRANCH_ID,
      title: "Updated resume title",
      consultantTitle: "Updated consultant title",
      presentation: ["Updated presentation"],
      summary: "Updated summary",
      highlightedItems: ["Principal Engineer", "Tech Lead"],
      education: [{ type: "course", value: "Distributed Systems", sortOrder: 0 }],
    });
  });

  it("throws NOT_FOUND when the branch does not exist", async () => {
    vi.mocked(readBranchAssignmentContent).mockResolvedValueOnce(null);

    await expect(
      updateResumeBranchContent(buildDb(), MOCK_ADMIN, {
        branchId: BRANCH_ID,
        summary: "Updated summary",
      }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
  });

  it("throws FORBIDDEN when a consultant edits another employee's branch", async () => {
    vi.mocked(resolveEmployeeId).mockResolvedValueOnce("550e8400-e29b-41d4-a716-446655440099");

    await expect(
      updateResumeBranchContent(buildDb(), MOCK_CONSULTANT_2, {
        branchId: BRANCH_ID,
        summary: "Updated summary",
      }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ORPCError && error.code === "FORBIDDEN",
    );
  });
});

describe("createUpdateResumeBranchContentHandler", () => {
  beforeEach(() => {
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(BRANCH as never);
    vi.mocked(upsertBranchContentFromLive).mockResolvedValue({
      ...BRANCH.content,
      title: "My Resume",
      consultantTitle: "Updated consultant title",
      presentation: ["Updated presentation"],
      summary: "Updated summary",
      highlightedItems: ["Principal Engineer"],
      education: [],
    } as never);
    vi.mocked(resolveEmployeeId).mockResolvedValue(EMPLOYEE_ID);
  });

  it("updates content for an authenticated consultant", async () => {
    const handler = createUpdateResumeBranchContentHandler(buildDb());

    const result = await call(
      handler,
      { branchId: BRANCH_ID, summary: "Updated summary" },
      { context: { user: MOCK_CONSULTANT } },
    );

    expect(result.branchId).toBe(BRANCH_ID);
    expect(result.title).toBe("My Resume");
    expect(result.summary).toBe("Updated summary");
  });

  it("throws UNAUTHORIZED when no user is present", async () => {
    const handler = createUpdateResumeBranchContentHandler(buildDb());

    await expect(
      call(handler, { branchId: BRANCH_ID, summary: "Updated summary" }, { context: {} }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ORPCError && error.code === "UNAUTHORIZED",
    );
  });
});
