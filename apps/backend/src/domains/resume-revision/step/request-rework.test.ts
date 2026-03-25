import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { requestRevisionStepRework } from "./request-rework.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STEP_ID = "550e8400-e29b-41d4-a716-446655440051";
const WORKFLOW_ID = "550e8400-e29b-41d4-a716-446655440041";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";

const STEP_ROW_REVIEWING = {
  id: STEP_ID,
  workflow_id: WORKFLOW_ID,
  section: "consultant_title",
  step_order: 1,
  status: "reviewing",
  approved_message_id: null,
  commit_id: null,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  resume_id: RESUME_ID,
  base_branch_id: "branch-1",
  revision_branch_id: null,
  workflow_status: "in_progress",
  employee_id: "emp-1",
};

// ---------------------------------------------------------------------------
// Mock builder
//
// fetchStepWithAuth internally calls resolveEmployeeId + a joined query.
// fetchStepsWithMessages calls selectFrom("resume_revision_workflow_steps")
// then selectFrom("resume_revision_messages").
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  stepRow?: unknown;
  stepStatus?: string;
  afterUpdateStepRows?: unknown[];
  messageRows?: unknown[];
} = {}) {
  const {
    stepRow,
    stepStatus = "reviewing",
    afterUpdateStepRows,
    messageRows = [],
  } = opts;

  const resolvedStep = stepRow === null
    ? undefined
    : (stepRow ?? { ...STEP_ROW_REVIEWING, status: stepStatus });

  // resolveEmployeeId — admin path: no DB query needed (returns null directly).
  // For MOCK_ADMIN, role === "admin" so the employees table is never queried.

  // fetchStepWithAuth: selectFrom("resume_revision_workflow_steps as s")
  //   .innerJoin("resume_revision_workflows as w", ...).innerJoin("resumes as r", ...)
  //   .select([...]).where(...).executeTakeFirst()
  const stepExecuteTakeFirst = vi.fn().mockResolvedValue(resolvedStep);
  const stepWhere = vi.fn().mockReturnValue({ executeTakeFirst: stepExecuteTakeFirst });
  const stepSelect = vi.fn().mockReturnValue({ where: stepWhere });
  const stepInnerJoin2 = vi.fn().mockReturnValue({ select: stepSelect });
  const stepInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: stepInnerJoin2 });

  // fetchStepsWithMessages — first query: all steps for workflow
  const updatedStepRows = afterUpdateStepRows ?? [
    { ...STEP_ROW_REVIEWING, status: "needs_rework" },
  ];
  const stepsExecute = vi.fn().mockResolvedValue(updatedStepRows);
  const stepsOrderBy = vi.fn().mockReturnValue({ execute: stepsExecute });
  const stepsWhere = vi.fn().mockReturnValue({ orderBy: stepsOrderBy });
  const stepsSelectAll = vi.fn().mockReturnValue({ where: stepsWhere });

  // fetchStepsWithMessages — second query: messages for those steps
  const msgsExecute = vi.fn().mockResolvedValue(messageRows);
  const msgsOrderBy = vi.fn().mockReturnValue({ execute: msgsExecute });
  const msgsWhere = vi.fn().mockReturnValue({ orderBy: msgsOrderBy });
  const msgsSelectAll = vi.fn().mockReturnValue({ where: msgsWhere });

  // transaction: updateTable + optional insertInto
  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const msgInsertExecute = vi.fn().mockResolvedValue(undefined);
  const msgInsertValues = vi.fn().mockReturnValue({ execute: msgInsertExecute });

  const insertInto = vi.fn().mockImplementation(() => ({ values: msgInsertValues }));

  const transaction = vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => {
      const trx = { updateTable, insertInto };
      return fn(trx);
    }),
  }));

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "resume_revision_workflow_steps as s") return { innerJoin: stepInnerJoin1 };
    if (table === "resume_revision_workflow_steps") return { selectAll: stepsSelectAll };
    if (table === "resume_revision_messages") return { selectAll: msgsSelectAll };
    return {};
  });

  const db = { selectFrom, transaction } as unknown as Kysely<Database>;
  return { db, updateSet, msgInsertValues };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requestRevisionStepRework", () => {
  it("throws BAD_REQUEST when step status is not reviewing", async () => {
    const { db } = buildDbMock({ stepStatus: "pending" });

    await expect(
      requestRevisionStepRework(db, MOCK_ADMIN, { stepId: STEP_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST"
    );
  });

  it("throws BAD_REQUEST when step status is approved", async () => {
    const { db } = buildDbMock({ stepStatus: "approved" });

    await expect(
      requestRevisionStepRework(db, MOCK_ADMIN, { stepId: STEP_ID })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "BAD_REQUEST"
    );
  });

  it("sets step status to needs_rework", async () => {
    const { db, updateSet } = buildDbMock({ stepStatus: "reviewing" });

    await requestRevisionStepRework(db, MOCK_ADMIN, { stepId: STEP_ID });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_rework" })
    );
  });

  it("inserts feedback as a user message when feedback is provided", async () => {
    const { db, msgInsertValues } = buildDbMock({ stepStatus: "reviewing" });

    await requestRevisionStepRework(db, MOCK_ADMIN, {
      stepId: STEP_ID,
      feedback: "Please revise the tone",
    });

    expect(msgInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: STEP_ID,
        role: "user",
        content: "Please revise the tone",
      })
    );
  });

  it("does not insert a message when feedback is omitted", async () => {
    const { db, msgInsertValues } = buildDbMock({ stepStatus: "reviewing" });

    await requestRevisionStepRework(db, MOCK_ADMIN, { stepId: STEP_ID });

    expect(msgInsertValues).not.toHaveBeenCalled();
  });

  it("does not insert a message when feedback is an empty string", async () => {
    const { db, msgInsertValues } = buildDbMock({ stepStatus: "reviewing" });

    await requestRevisionStepRework(db, MOCK_ADMIN, {
      stepId: STEP_ID,
      feedback: "",
    });

    expect(msgInsertValues).not.toHaveBeenCalled();
  });

  it("does not insert a message when feedback is only whitespace", async () => {
    const { db, msgInsertValues } = buildDbMock({ stepStatus: "reviewing" });

    await requestRevisionStepRework(db, MOCK_ADMIN, {
      stepId: STEP_ID,
      feedback: "   ",
    });

    expect(msgInsertValues).not.toHaveBeenCalled();
  });

  it("returns the updated step in the response", async () => {
    const { db } = buildDbMock({ stepStatus: "reviewing" });

    const result = await requestRevisionStepRework(db, MOCK_ADMIN, { stepId: STEP_ID });

    expect(result.step).toBeDefined();
    expect(result.step.id).toBe(STEP_ID);
  });
});
