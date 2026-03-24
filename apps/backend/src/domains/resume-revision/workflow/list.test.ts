import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { listResumeRevisionWorkflows } from "./list.js";
import { MOCK_ADMIN, MOCK_CONSULTANT, MOCK_CONSULTANT_2 } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const WORKFLOW_ID_1 = "550e8400-e29b-41d4-a716-446655440041";
const WORKFLOW_ID_2 = "550e8400-e29b-41d4-a716-446655440042";
const EMPLOYEE_ID_1 = "550e8400-e29b-41d4-a716-446655440011";
const EMPLOYEE_ID_2 = "550e8400-e29b-41d4-a716-446655440012";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeWorkflowRow(id: string) {
  return {
    id,
    resume_id: RESUME_ID,
    base_branch_id: "branch-1",
    revision_branch_id: null,
    created_by: MOCK_ADMIN.id,
    status: "in_progress",
    created_at: NOW,
    updated_at: NOW,
  };
}

function makeStepRow(workflowId: string, section: string, stepOrder: number, status: string) {
  return {
    id: `step-${workflowId}-${stepOrder}`,
    workflow_id: workflowId,
    section,
    step_order: stepOrder,
    status,
  };
}

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  resumeRow?: unknown;
  workflowRows?: unknown[];
  stepRows?: unknown[];
  employeeId?: string | null;
} = {}) {
  const {
    resumeRow = { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 },
    workflowRows = [makeWorkflowRow(WORKFLOW_ID_1)],
    stepRows = [makeStepRow(WORKFLOW_ID_1, "discovery", 0, "pending")],
    employeeId = null,
  } = opts;

  const resolvedResume = resumeRow === null ? undefined : resumeRow;

  // Employee lookup (resolveEmployeeId)
  const empExecuteTakeFirst = vi.fn().mockResolvedValue(employeeId ? { id: employeeId } : undefined);
  const empWhere = vi.fn().mockReturnValue({ executeTakeFirst: empExecuteTakeFirst });
  const empSelect = vi.fn().mockReturnValue({ where: empWhere });

  // Resume ownership query: selectFrom("resumes").select([...]).where(...).executeTakeFirst()
  const resumeExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedResume);
  const resumeWhere = vi.fn().mockReturnValue({ executeTakeFirst: resumeExecuteTakeFirst });
  const resumeSelect = vi.fn().mockReturnValue({ where: resumeWhere });

  // Workflows query: selectFrom("resume_revision_workflows").selectAll().where(...).orderBy(...).execute()
  const workflowsExecute = vi.fn().mockResolvedValue(workflowRows);
  const workflowsOrderBy = vi.fn().mockReturnValue({ execute: workflowsExecute });
  const workflowsWhere = vi.fn().mockReturnValue({ orderBy: workflowsOrderBy });
  const workflowsSelectAll = vi.fn().mockReturnValue({ where: workflowsWhere });

  // Steps query: selectFrom("resume_revision_workflow_steps").select([...]).where(...).orderBy(...).execute()
  const stepsExecute = vi.fn().mockResolvedValue(stepRows);
  const stepsOrderBy = vi.fn().mockReturnValue({ execute: stepsExecute });
  const stepsWhere = vi.fn().mockReturnValue({ orderBy: stepsOrderBy });
  const stepsSelect = vi.fn().mockReturnValue({ where: stepsWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") return { select: empSelect };
    if (table === "resumes") return { select: resumeSelect };
    if (table === "resume_revision_workflows") return { selectAll: workflowsSelectAll };
    if (table === "resume_revision_workflow_steps") return { select: stepsSelect };
    return {};
  });

  const db = { selectFrom } as unknown as Kysely<Database>;
  return { db };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listResumeRevisionWorkflows", () => {
  it("returns empty array when no workflows exist", async () => {
    const { db } = buildDbMock({ workflowRows: [] });

    const result = await listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result).toEqual([]);
  });

  it("returns activeStepSection as the first non-approved section", async () => {
    const steps = [
      makeStepRow(WORKFLOW_ID_1, "discovery", 0, "approved"),
      makeStepRow(WORKFLOW_ID_1, "consultant_title", 1, "reviewing"),
      makeStepRow(WORKFLOW_ID_1, "presentation_summary", 2, "pending"),
    ];
    const { db } = buildDbMock({ stepRows: steps });

    const result = await listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result[0].activeStepSection).toBe("consultant_title");
  });

  it("returns activeStepSection as null when all steps are approved (completed workflow)", async () => {
    const steps = [
      makeStepRow(WORKFLOW_ID_1, "discovery", 0, "approved"),
      makeStepRow(WORKFLOW_ID_1, "consultant_title", 1, "approved"),
    ];
    const { db } = buildDbMock({ stepRows: steps });

    const result = await listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result[0].activeStepSection).toBeNull();
  });

  it("returns activeStepSection as the first section when none are approved", async () => {
    const steps = [
      makeStepRow(WORKFLOW_ID_1, "discovery", 0, "pending"),
      makeStepRow(WORKFLOW_ID_1, "consultant_title", 1, "pending"),
    ];
    const { db } = buildDbMock({ stepRows: steps });

    const result = await listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result[0].activeStepSection).toBe("discovery");
  });

  it("correctly maps resumeId and baseBranchId on each workflow", async () => {
    const { db } = buildDbMock();

    const result = await listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID });

    expect(result[0].resumeId).toBe(RESUME_ID);
    expect(result[0].baseBranchId).toBe("branch-1");
  });

  it("throws NOT_FOUND when resume does not exist", async () => {
    const { db } = buildDbMock({ resumeRow: null });

    await expect(
      listResumeRevisionWorkflows(db, MOCK_ADMIN, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND"
    );
  });

  it("throws FORBIDDEN when consultant tries to list another employee's workflows", async () => {
    const { db } = buildDbMock({
      employeeId: EMPLOYEE_ID_2,
      resumeRow: { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 },
    });

    await expect(
      listResumeRevisionWorkflows(db, MOCK_CONSULTANT_2, { resumeId: RESUME_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "FORBIDDEN"
    );
  });

  it("allows a consultant to list workflows for their own resume", async () => {
    const { db } = buildDbMock({
      employeeId: EMPLOYEE_ID_1,
      resumeRow: { id: RESUME_ID, employee_id: EMPLOYEE_ID_1 },
    });

    const result = await listResumeRevisionWorkflows(db, MOCK_CONSULTANT, { resumeId: RESUME_ID });

    expect(result).toHaveLength(1);
  });
});
