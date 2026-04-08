import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createCreateResumeHandler, createResume } from "./create.js";
import { MOCK_ADMIN, MOCK_CONSULTANT } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Unit tests for the createResume procedure.
// ---------------------------------------------------------------------------

const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const COMMIT_ID = "550e8400-e29b-41d4-a716-446655440041";

const NEW_RESUME_ROW = {
  id: RESUME_ID,
  employee_id: EMPLOYEE_ID_1,
  title: "New Backend Resume",
  summary: null,
  language: "en",
  is_main: false,
  created_at: new Date("2025-03-01T00:00:00.000Z"),
  updated_at: new Date("2025-03-01T00:00:00.000Z"),
};

const NEW_BRANCH_ROW = {
  id: BRANCH_ID,
  resume_id: RESUME_ID,
  name: "main",
  language: "en",
  is_main: true,
  head_commit_id: null,
  forked_from_commit_id: null,
  created_by: MOCK_ADMIN.id,
  created_at: new Date("2025-03-01T00:00:00.000Z"),
};

const ROOT_COMMIT_ROW = {
  id: COMMIT_ID,
  resume_id: RESUME_ID,
  parent_commit_id: null,
  content: {},
  message: "initial",
  created_by: MOCK_ADMIN.id,
  created_at: new Date("2025-03-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

/**
 * Builds a mock Kysely instance that handles the full transactional
 * createResume flow: INSERT resume → INSERT branch → INSERT commit → UPDATE branch HEAD.
 */
function buildDbMock(opts: {
  resumeRow?: unknown;
  branchRow?: unknown;
  commitRow?: unknown;
  employeeRow?: unknown;
} = {}) {
  const {
    resumeRow = NEW_RESUME_ROW,
    branchRow = NEW_BRANCH_ROW,
    commitRow = ROOT_COMMIT_ROW,
    employeeRow = undefined,
  } = opts;

  // INSERT resumes
  const resumeInsertExec = vi.fn().mockResolvedValue(resumeRow);
  const resumeInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: resumeInsertExec });
  const resumeInsertValues = vi.fn().mockReturnValue({ returningAll: resumeInsertReturningAll });

  // INSERT resume_branches
  const branchInsertExec = vi.fn().mockResolvedValue(branchRow);
  const branchInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: branchInsertExec });
  const branchInsertValues = vi.fn().mockReturnValue({ returningAll: branchInsertReturningAll });

  // INSERT resume_commits
  const commitInsertExec = vi.fn().mockResolvedValue(commitRow);
  const commitInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: commitInsertExec });
  const commitInsertValues = vi.fn().mockReturnValue({ returningAll: commitInsertReturningAll });

  // UPDATE resume_branches (advance HEAD)
  const updateExec = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExec });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resumes") return { values: resumeInsertValues };
    if (table === "resume_branches") return { values: branchInsertValues };
    if (table === "resume_commits") return { values: commitInsertValues };
    return {};
  });

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { insertInto, updateTable };
      return fn(trx);
    }),
  }));

  // Employee lookup (used by consultants)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeRow);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    return {};
  });

  const db = { insertInto, selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, resumeInsertValues, branchInsertValues, commitInsertValues, updateSet };
}

// ---------------------------------------------------------------------------
// Tests: createResume query function
// ---------------------------------------------------------------------------

describe("createResume query function", () => {
  it("admin creates resume and returns it with empty skills, mainBranchId, and headCommitId", async () => {
    const { db, resumeInsertValues } = buildDbMock();

    const result = await createResume(db, MOCK_ADMIN, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      id: RESUME_ID,
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      mainBranchId: BRANCH_ID,
      headCommitId: COMMIT_ID,
    });
    expect(result.skills).toEqual([]);
    expect(resumeInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: EMPLOYEE_ID_1,
        title: "New Backend Resume",
        language: "en",
      })
    );
  });

  it("creates main branch atomically with the resume", async () => {
    const { db, branchInsertValues } = buildDbMock();

    await createResume(db, MOCK_ADMIN, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(branchInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        name: "main",
        is_main: true,
        language: "en",
        created_by: MOCK_ADMIN.id,
      })
    );
  });

  it("creates root commit atomically and advances branch HEAD", async () => {
    const { db, commitInsertValues, updateSet } = buildDbMock();

    await createResume(db, MOCK_ADMIN, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(commitInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        message: "initial",
        created_by: MOCK_ADMIN.id,
      })
    );
    expect(updateSet).toHaveBeenCalledWith({ head_commit_id: COMMIT_ID });
  });

  it("consultant creates resume for their own employee_id and succeeds", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_1 } });

    const result = await createResume(db, MOCK_CONSULTANT, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result.id).toBe(RESUME_ID);
  });

  it("throws FORBIDDEN when consultant tries to create a resume for a different employee", async () => {
    const { db } = buildDbMock({ employeeRow: { id: EMPLOYEE_ID_1 } });

    await expect(
      createResume(db, MOCK_CONSULTANT, {
        employeeId: EMPLOYEE_ID_2,
        title: "Hack Attempt",
        language: "en",
        summary: null,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("maps DB snake_case fields to camelCase in output", async () => {
    const { db } = buildDbMock();

    const result = await createResume(db, MOCK_ADMIN, {
      employeeId: EMPLOYEE_ID_1,
      title: "New Backend Resume",
      language: "en",
      summary: null,
    });

    expect(result).toMatchObject({
      employeeId: EMPLOYEE_ID_1,
      isMain: false,
      mainBranchId: BRANCH_ID,
      headCommitId: COMMIT_ID,
      createdAt: NEW_RESUME_ROW.created_at,
      updatedAt: NEW_RESUME_ROW.updated_at,
    });
    expect(result).not.toHaveProperty("employee_id");
  });
});

// ---------------------------------------------------------------------------
// Tests: createCreateResumeHandler (oRPC handler)
// ---------------------------------------------------------------------------

describe("createCreateResumeHandler", () => {
  it("creates a resume for authenticated admin", async () => {
    const { db } = buildDbMock();
    const handler = createCreateResumeHandler(db);

    const result = await call(
      handler,
      { employeeId: EMPLOYEE_ID_1, title: "New Backend Resume", language: "en" },
      { context: { user: MOCK_ADMIN } }
    );

    expect(result.id).toBe(RESUME_ID);
    expect(result.skills).toEqual([]);
    expect(result.mainBranchId).toBe(BRANCH_ID);
    expect(result.headCommitId).toBe(COMMIT_ID);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const { db } = buildDbMock();
    const handler = createCreateResumeHandler(db);

    await expect(
      call(
        handler,
        { employeeId: EMPLOYEE_ID_1, title: "New Resume", language: "en" },
        { context: {} }
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
