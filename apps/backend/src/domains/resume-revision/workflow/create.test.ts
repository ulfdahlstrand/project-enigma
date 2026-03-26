import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createResumeRevisionWorkflow } from "./create.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";
import { STEP_SECTIONS } from "../lib/step-sections.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const BRANCH_ID_2 = "550e8400-e29b-41d4-a716-446655440032";
const WORKFLOW_ID = "550e8400-e29b-41d4-a716-446655440041";
const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";

const WORKFLOW_ROW = {
  id: WORKFLOW_ID,
  resume_id: RESUME_ID,
  base_branch_id: BRANCH_ID,
  revision_branch_id: null,
  created_by: MOCK_ADMIN.id,
  status: "active",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

function makeStepRows() {
  return STEP_SECTIONS.map((section, idx) => ({
    id: `step-${idx}`,
    workflow_id: WORKFLOW_ID,
    section,
    step_order: idx,
    status: "pending",
    approved_message_id: null,
    commit_id: null,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  }));
}

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  branchRow?: unknown;
  employeeId?: string | null;
  existingActiveWorkflowId?: string | null;
} = {}) {
  const {
    branchRow = { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 },
    employeeId = null,
    existingActiveWorkflowId = null,
  } = opts;

  const resolvedBranch = branchRow === null ? undefined : branchRow;

  // Employee lookup (resolveEmployeeId)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Branch ownership query: selectFrom("resume_branches as rb").innerJoin(...).select(...).where(...).where(...).executeTakeFirst()
  const branchExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedBranch);
  const branchWhere2 = vi.fn().mockReturnValue({ executeTakeFirst: branchExecuteTakeFirst });
  const branchWhere1 = vi.fn().mockReturnValue({ where: branchWhere2 });
  const branchSelect = vi.fn().mockReturnValue({ where: branchWhere1 });
  const branchInnerJoin = vi.fn().mockReturnValue({ select: branchSelect });

  // Commit content query: selectFrom("resume_branches as rb").leftJoin(...).select(...).where(...).executeTakeFirst()
  const commitExecuteTakeFirst = vi.fn().mockResolvedValue({ head_commit_id: null, content: null });
  const commitWhere = vi.fn().mockReturnValue({ executeTakeFirst: commitExecuteTakeFirst });
  const commitSelect = vi.fn().mockReturnValue({ where: commitWhere });
  const branchLeftJoin = vi.fn().mockReturnValue({ select: commitSelect });

  const existingWorkflowExecuteTakeFirst = vi
    .fn()
    .mockResolvedValue(
      existingActiveWorkflowId
        ? { id: existingActiveWorkflowId }
        : undefined
    );
  const existingWorkflowOrderBy = vi.fn().mockReturnValue({
    executeTakeFirst: existingWorkflowExecuteTakeFirst,
  });
  const existingWorkflowWhereStatus = vi.fn().mockReturnValue({
    orderBy: existingWorkflowOrderBy,
  });
  const existingWorkflowWhereBaseBranch = vi.fn().mockReturnValue({
    where: existingWorkflowWhereStatus,
  });
  const existingWorkflowWhereResume = vi.fn().mockReturnValue({
    where: existingWorkflowWhereBaseBranch,
  });
  const existingWorkflowSelect = vi.fn().mockReturnValue({
    where: existingWorkflowWhereResume,
  });

  const workflowWithAuthExecuteTakeFirst = vi.fn().mockResolvedValue({
    ...WORKFLOW_ROW,
    id: existingActiveWorkflowId ?? WORKFLOW_ID,
    base_branch_id: BRANCH_ID,
    status: "active",
    employee_id: EMPLOYEE_ID_1,
  });
  const workflowWithAuthWhere = vi.fn().mockReturnValue({
    executeTakeFirst: workflowWithAuthExecuteTakeFirst,
  });
  const workflowWithAuthSelect = vi.fn().mockReturnValue({
    where: workflowWithAuthWhere,
  });
  const workflowWithAuthInnerJoin = vi.fn().mockReturnValue({
    select: workflowWithAuthSelect,
  });

  const stepsForExistingExecute = vi.fn().mockResolvedValue(makeStepRows());
  const stepsForExistingOrderBy = vi.fn().mockReturnValue({
    execute: stepsForExistingExecute,
  });
  const stepsForExistingWhere = vi.fn().mockReturnValue({
    orderBy: stepsForExistingOrderBy,
  });
  const stepsForExistingSelectAll = vi.fn().mockReturnValue({
    where: stepsForExistingWhere,
  });

  const messagesExecute = vi.fn().mockResolvedValue([]);
  const messagesOrderBy = vi.fn().mockReturnValue({ execute: messagesExecute });
  const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
  const messagesSelectAll = vi.fn().mockReturnValue({ where: messagesWhere });

  // Workflow insert (inside transaction)
  const wfInsertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue(WORKFLOW_ROW);
  const wfInsertReturningAll = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: wfInsertExecuteTakeFirstOrThrow });
  const wfInsertValues = vi.fn().mockReturnValue({ returningAll: wfInsertReturningAll });

  // Steps insert (inside transaction)
  const stepsInsertExecute = vi.fn().mockResolvedValue(makeStepRows());
  const stepsInsertReturningAll = vi.fn().mockReturnValue({ execute: stepsInsertExecute });
  const stepsInsertValues = vi.fn().mockReturnValue({ returningAll: stepsInsertReturningAll });

  const insertInto = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_revision_workflows") return { values: wfInsertValues };
    if (table === "resume_revision_workflow_steps") return { values: stepsInsertValues };
    return {};
  });

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { insertInto };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resume_revision_workflows as w") {
      return { innerJoin: workflowWithAuthInnerJoin };
    }
    if (table === "resume_revision_workflows") {
      if (existingActiveWorkflowId !== null) {
        return { select: existingWorkflowSelect };
      }
      return { innerJoin: workflowWithAuthInnerJoin, select: existingWorkflowSelect };
    }
    if (table === "resume_revision_workflow_steps") return { selectAll: stepsForExistingSelectAll };
    if (table === "resume_revision_messages") return { selectAll: messagesSelectAll };
    return { innerJoin: branchInnerJoin, leftJoin: branchLeftJoin };
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, stepsInsertValues, wfInsertValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createResumeRevisionWorkflow", () => {
  it("creates a workflow with exactly 7 steps in order (step_order 0..6)", async () => {
    const { db, stepsInsertValues } = buildDbMock();

    await createResumeRevisionWorkflow(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID,
    });

    const stepPayload = stepsInsertValues.mock.calls[0][0] as Array<{
      step_order: number;
      section: string;
    }>;
    expect(stepPayload).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      expect(stepPayload[i].step_order).toBe(i);
      expect(stepPayload[i].section).toBe(STEP_SECTIONS[i]);
    }
  });

  it("inserts workflow with correct resume and branch references", async () => {
    const { db, wfInsertValues } = buildDbMock();

    await createResumeRevisionWorkflow(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID,
    });

    expect(wfInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_id: RESUME_ID,
        base_branch_id: BRANCH_ID,
        created_by: MOCK_ADMIN.id,
      })
    );
  });

  it("throws NOT_FOUND when branch does not exist", async () => {
    const { db } = buildDbMock({ branchRow: null });

    await expect(
      createResumeRevisionWorkflow(db, MOCK_ADMIN, {
        resumeId: RESUME_ID,
        baseBranchId: BRANCH_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws FORBIDDEN when consultant does not own the resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_2, branchRow: { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 } });

    await expect(
      createResumeRevisionWorkflow(db, MOCK_CONSULTANT_2, {
        resumeId: RESUME_ID,
        baseBranchId: BRANCH_ID,
      })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("allows a consultant to create a workflow for their own resume", async () => {
    const { db } = buildDbMock({ employeeId: EMPLOYEE_ID_1, branchRow: { id: BRANCH_ID, employee_id: EMPLOYEE_ID_1 } });

    const result = await createResumeRevisionWorkflow(db, MOCK_CONSULTANT, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID,
    });

    expect(result.id).toBe(WORKFLOW_ID);
  });

  it("returns the mapped workflow with steps", async () => {
    const { db } = buildDbMock();

    const result = await createResumeRevisionWorkflow(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID,
    });

    expect(result.id).toBe(WORKFLOW_ID);
    expect(result.steps).toHaveLength(7);
    expect(result.steps[0].section).toBe("discovery");
    expect(result.steps[6].section).toBe("consistency_polish");
  });

  it("reuses an existing active workflow for the same resume and branch", async () => {
    const existingId = "550e8400-e29b-41d4-a716-446655440099";
    const { db, wfInsertValues } = buildDbMock({ existingActiveWorkflowId: existingId });

    const result = await createResumeRevisionWorkflow(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID,
    });

    expect(result.id).toBe(existingId);
    expect(wfInsertValues).not.toHaveBeenCalled();
  });

  it("allows a different branch to create its own active workflow", async () => {
    const { db, wfInsertValues } = buildDbMock({
      branchRow: { id: BRANCH_ID_2, employee_id: EMPLOYEE_ID_1 },
    });

    await createResumeRevisionWorkflow(db, MOCK_ADMIN, {
      resumeId: RESUME_ID,
      baseBranchId: BRANCH_ID_2,
    });

    expect(wfInsertValues).toHaveBeenCalled();
  });
});
