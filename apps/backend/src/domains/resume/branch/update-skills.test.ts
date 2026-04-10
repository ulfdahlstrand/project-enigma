import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import {
  createUpdateResumeBranchSkillsHandler,
  updateResumeBranchSkills,
} from "./update-skills.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { readBranchAssignmentContent } from "../lib/branch-assignment-content.js";
import { upsertBranchContentFromLive } from "../lib/upsert-branch-content-from-live.js";

vi.mock("../lib/branch-assignment-content.js", () => ({
  readBranchAssignmentContent: vi.fn(),
}));

vi.mock("../lib/upsert-branch-content-from-live.js", () => ({
  upsertBranchContentFromLive: vi.fn().mockResolvedValue(undefined),
}));

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440021";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440022";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440023";

function buildBranch(employeeId = EMPLOYEE_ID_1) {
  return {
    branchId: BRANCH_ID,
    resumeId: "resume-1",
    employeeId,
    title: "Resume",
    language: "en",
    createdAt: new Date("2023-01-01"),
    content: {
      assignments: [],
      skillGroups: [],
      skills: [],
    },
  };
}

function buildDbMock(employeeId: string | null = null) {
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });
  return {
    db: {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "employees") return { select: empSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as Kysely<Database>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateResumeBranchSkills", () => {
  it("writes normalized skills and skill groups back to branch content", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(
      buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>,
    );

    const result = await updateResumeBranchSkills(db, MOCK_ADMIN, {
      branchId: BRANCH_ID,
      skillGroups: [{ name: " Leadership ", sortOrder: 0 }],
      skills: [{ name: " System design ", category: " Leadership ", sortOrder: 0 }],
    });

    expect(upsertBranchContentFromLive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        branchId: BRANCH_ID,
        skillGroups: [{ name: "Leadership", sortOrder: 0 }],
        skills: [{ name: "System design", category: "Leadership", sortOrder: 0 }],
      }),
    );
    expect(result).toEqual({
      branchId: BRANCH_ID,
      skillGroups: [{ name: "Leadership", sortOrder: 0 }],
      skills: [{ name: "System design", category: "Leadership", sortOrder: 0 }],
    });
  });

  it("consultant can update their own branch skills", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_1);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(
      buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>,
    );

    await expect(
      updateResumeBranchSkills(db, MOCK_CONSULTANT, {
        branchId: BRANCH_ID,
        skillGroups: [],
        skills: [],
      }),
    ).resolves.toEqual({ branchId: BRANCH_ID, skillGroups: [], skills: [] });
  });

  it("throws FORBIDDEN when consultant accesses another employee's branch", async () => {
    const { db } = buildDbMock(EMPLOYEE_ID_2);
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(
      buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>,
    );

    await expect(
      updateResumeBranchSkills(db, MOCK_CONSULTANT_2, {
        branchId: BRANCH_ID,
        skillGroups: [],
        skills: [],
      }),
    ).rejects.toSatisfy((err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN");
  });
});

describe("createUpdateResumeBranchSkillsHandler", () => {
  it("uses the authenticated user from context", async () => {
    const { db } = buildDbMock();
    vi.mocked(readBranchAssignmentContent).mockResolvedValue(
      buildBranch() as Awaited<ReturnType<typeof readBranchAssignmentContent>>,
    );

    const handler = createUpdateResumeBranchSkillsHandler(db);
    const result = await call(
      handler,
      {
        branchId: BRANCH_ID,
        skillGroups: [],
        skills: [],
      },
      { context: { user: MOCK_ADMIN } },
    );

    expect(result.branchId).toBe(BRANCH_ID);
  });

  it("throws UNAUTHORIZED when no user exists in context", async () => {
    const { db } = buildDbMock();
    const handler = createUpdateResumeBranchSkillsHandler(db);

    await expect(
      call(
        handler,
        {
          branchId: BRANCH_ID,
          skillGroups: [],
          skills: [],
        },
        { context: {} },
      ),
    ).rejects.toSatisfy((err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED");
  });
});

