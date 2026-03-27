import { describe, it, expect, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { normaliseAssignmentIds } from "./sync-branch-assignments.js";

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440051";
const GENERATED_UUID = "550e8400-e29b-41d4-a716-446655440099";

function makeAssignment(assignmentId: string) {
  return {
    assignmentId,
    clientName: "Acme",
    role: "Engineer",
    description: null,
    startDate: "2020-01-01",
    endDate: null,
    technologies: [],
    isCurrent: false,
    keywords: null,
    type: null,
    highlight: false,
    sortOrder: null,
  };
}

function buildDbMock(generatedId = GENERATED_UUID) {
  const insertReturningExec = vi.fn().mockResolvedValue({ id: generatedId });
  const insertReturning = vi.fn().mockReturnValue({
    executeTakeFirstOrThrow: insertReturningExec,
  });
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  return {
    db: { insertInto } as unknown as Kysely<Database>,
    insertInto,
    insertValues,
  };
}

describe("normaliseAssignmentIds", () => {
  it("returns the same object when all IDs are valid UUIDs", async () => {
    const { db } = buildDbMock();
    const content: ResumeCommitContent = {
      assignments: [makeAssignment(VALID_UUID)],
    } as unknown as ResumeCommitContent;

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result).toBe(content);
  });

  it("replaces non-UUID IDs with generated UUIDs", async () => {
    const { db, insertInto } = buildDbMock(GENERATED_UUID);
    const content: ResumeCommitContent = {
      assignments: [makeAssignment("1"), makeAssignment("2")],
    } as unknown as ResumeCommitContent;

    // Return different UUIDs for the two sequential inserts
    const exec = vi.fn()
      .mockResolvedValueOnce({ id: GENERATED_UUID })
      .mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440100" });
    const returning = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: exec });
    const values = vi.fn().mockReturnValue({ returning });
    (insertInto as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result).not.toBe(content);
    expect(result.assignments[0].assignmentId).toBe(GENERATED_UUID);
    expect(result.assignments[1].assignmentId).toBe("550e8400-e29b-41d4-a716-446655440100");
  });

  it("only replaces invalid IDs and leaves valid UUIDs unchanged", async () => {
    const { db } = buildDbMock(GENERATED_UUID);
    const content: ResumeCommitContent = {
      assignments: [makeAssignment(VALID_UUID), makeAssignment("1")],
    } as unknown as ResumeCommitContent;

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result.assignments[0].assignmentId).toBe(VALID_UUID);
    expect(result.assignments[1].assignmentId).toBe(GENERATED_UUID);
  });

  it("inserts into assignments table with correct employee_id", async () => {
    const { db, insertInto, insertValues } = buildDbMock(GENERATED_UUID);
    const content: ResumeCommitContent = {
      assignments: [makeAssignment("1")],
    } as unknown as ResumeCommitContent;

    await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(insertInto).toHaveBeenCalledWith("assignments");
    expect(insertValues).toHaveBeenCalledWith({ employee_id: EMPLOYEE_ID });
  });

  it("returns same object for empty assignments", async () => {
    const { db } = buildDbMock();
    const content: ResumeCommitContent = {
      assignments: [],
    } as unknown as ResumeCommitContent;

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result).toBe(content);
  });

  it("replaces null startDate with today's date string", async () => {
    const { db } = buildDbMock();
    const assignment = { ...makeAssignment(VALID_UUID), startDate: null as unknown as string };
    const content: ResumeCommitContent = {
      assignments: [assignment],
    } as unknown as ResumeCommitContent;

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result.assignments[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("replaces empty startDate with today's date string", async () => {
    const { db } = buildDbMock();
    const assignment = { ...makeAssignment(VALID_UUID), startDate: "" };
    const content: ResumeCommitContent = {
      assignments: [assignment],
    } as unknown as ResumeCommitContent;

    const result = await normaliseAssignmentIds(db, EMPLOYEE_ID, content);

    expect(result.assignments[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
