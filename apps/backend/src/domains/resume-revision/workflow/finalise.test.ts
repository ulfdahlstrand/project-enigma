import { describe, it, expect, vi } from "vitest";
import type { Kysely } from "kysely";
import type OpenAI from "openai";
import type { Database } from "../../../db/types.js";
import { finaliseResumeRevision } from "./finalise.js";
import { MOCK_ADMIN } from "../../../test-helpers/mock-users.js";

const WORKFLOW_ID = "550e8400-e29b-41d4-a716-446655440041";
const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const BASE_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440031";
const REVISION_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440032";

function buildDbMock() {
  const workflowWithAuthExecuteTakeFirst = vi.fn().mockResolvedValue({
    id: WORKFLOW_ID,
    resume_id: RESUME_ID,
    base_branch_id: BASE_BRANCH_ID,
    revision_branch_id: REVISION_BRANCH_ID,
    created_by: MOCK_ADMIN.id,
    status: "completed",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    employee_id: "employee-1",
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

  const revisionCommitExecuteTakeFirst = vi.fn().mockResolvedValue({
    commit_id: "550e8400-e29b-41d4-a716-446655440099",
    content: { assignments: [], skills: [] },
  });
  const revisionCommitWhere = vi.fn().mockReturnValue({
    executeTakeFirst: revisionCommitExecuteTakeFirst,
  });
  const revisionCommitSelect = vi.fn().mockReturnValue({
    where: revisionCommitWhere,
  });
  const revisionCommitInnerJoin = vi.fn().mockReturnValue({
    select: revisionCommitSelect,
  });

  const updateExecute = vi.fn().mockResolvedValue([]);
  const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateTable = vi.fn().mockReturnValue({ set: updateSet });

  const workflowStepsExecute = vi.fn().mockResolvedValue([]);
  const workflowStepsOrderBy = vi.fn().mockReturnValue({ execute: workflowStepsExecute });
  const workflowStepsWhere = vi.fn().mockReturnValue({ orderBy: workflowStepsOrderBy });
  const workflowStepsSelectAll = vi.fn().mockReturnValue({ where: workflowStepsWhere });

  const messagesExecute = vi.fn().mockResolvedValue([]);
  const messagesOrderBy = vi.fn().mockReturnValue({ execute: messagesExecute });
  const messagesWhere = vi.fn().mockReturnValue({ orderBy: messagesOrderBy });
  const messagesSelectAll = vi.fn().mockReturnValue({ where: messagesWhere });

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "employees") {
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
    }
    if (table === "resume_revision_workflows as w") {
      return { innerJoin: workflowWithAuthInnerJoin };
    }
    if (table === "resume_branches as rb") {
      return { innerJoin: revisionCommitInnerJoin };
    }
    if (table === "resume_revision_workflow_steps") {
      return { selectAll: workflowStepsSelectAll };
    }
    if (table === "resume_revision_messages") {
      return { selectAll: messagesSelectAll };
    }
    return {};
  });

  const db = { selectFrom, updateTable } as unknown as Kysely<Database>;

  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "Revise CV presentation and skills" } }],
        }),
      },
    },
  } as unknown as OpenAI;

  return { db, updateSet, mockOpenAI };
}

describe("finaliseResumeRevision", () => {
  it("marks keep workflows as finalized", async () => {
    const { db, updateSet, mockOpenAI } = buildDbMock();

    await finaliseResumeRevision(db, mockOpenAI, MOCK_ADMIN, {
      workflowId: WORKFLOW_ID,
      action: "keep",
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalized" })
    );
  });
});
