import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import { call } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { importCv, createImportCvHandler } from "./import.js";

const EMP_ID = "550e8400-e29b-41d4-a716-446655440011";
const BRANCH_ID = "550e8400-e29b-41d4-a716-446655440099";

const BASE_CV_JSON = {
  consultant: {
    name: "Test User",
    title: "Senior Engineer",
    presentation: ["Expert in TypeScript"],
  },
  education: {
    degrees: ["Computer Science, MIT"],
    certifications: ["AWS Solutions Architect"],
    languages: ["English", "Swedish"],
  },
  assignments: [
    {
      role: "Senior Developer",
      client: "Acme Corp",
      period: "Q1 2023 - Q4 2023",
      description: "Built things.\n\nImproved performance.",
      technologies: ["TypeScript", "Node.js"],
      keywords: ["backend"],
    },
  ],
};

type MockDb = Kysely<Database> & {
  _mocks: {
    insertExecute: ReturnType<typeof vi.fn>;
    insertExecuteTakeFirstOrThrow: ReturnType<typeof vi.fn>;
    updateExecute: ReturnType<typeof vi.fn>;
    selectExecuteTakeFirst: ReturnType<typeof vi.fn>;
    selectExecuteTakeFirstOrThrow: ReturnType<typeof vi.fn>;
    insertValues: ReturnType<typeof vi.fn>;
  };
};

const MAIN_RESUME = { id: "resume-main-id" };

function buildDb({
  mainResume = undefined,
  existingAssignment = undefined,
  existingEducation = undefined,
}: {
  mainResume?: { id: string } | undefined;
  existingAssignment?: { id: string } | undefined;
  existingEducation?: { id: string } | undefined;
} = {}): MockDb {
  const insertExecute = vi.fn().mockResolvedValue(undefined);
  // Used when creating a new resume OR when creating assignment in transaction
  const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue({ id: "new-id" });
  const insertReturning = vi.fn().mockReturnValue({ executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow });
  const insertValues = vi.fn().mockReturnValue({ execute: insertExecute, returning: insertReturning });
  const insertInto = vi.fn().mockReturnValue({ values: insertValues });

  // selectFrom chain
  // Call order: 1) main resume lookup (executeTakeFirst), 2) assignment duplicate check (executeTakeFirst), 3+) education
  const selectExecuteTakeFirst = vi.fn()
    .mockResolvedValueOnce(mainResume)
    .mockResolvedValueOnce(existingAssignment)
    .mockResolvedValue(existingEducation);

  // Used for main branch lookup (executeTakeFirstOrThrow)
  const selectExecuteTakeFirstOrThrow = vi.fn().mockResolvedValue({ id: BRANCH_ID });

  const selectWhere = vi.fn();
  const selectSelect = vi.fn();
  const selectInnerJoin = vi.fn();
  const selectChain = {
    select: selectSelect,
    where: selectWhere,
    innerJoin: selectInnerJoin,
    executeTakeFirst: selectExecuteTakeFirst,
    executeTakeFirstOrThrow: selectExecuteTakeFirstOrThrow,
  };
  selectWhere.mockReturnValue(selectChain);
  selectSelect.mockReturnValue(selectChain);
  selectInnerJoin.mockReturnValue(selectChain);
  const selectFrom = vi.fn().mockReturnValue(selectChain);

  const updateExecute = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn();
  const updateSet = vi.fn();
  const updateChain = {
    set: updateSet,
    where: updateWhere,
    execute: updateExecute,
  };
  updateWhere.mockReturnValue(updateChain);
  updateSet.mockReturnValue(updateChain);
  const updateTable = vi.fn().mockReturnValue(updateChain);

  const db = {
    selectFrom,
    insertInto,
    updateTable,
    _mocks: { insertExecute, insertExecuteTakeFirstOrThrow, updateExecute, selectExecuteTakeFirst, selectExecuteTakeFirstOrThrow, insertValues },
  } as unknown as MockDb;

  // Transactions: pass the same mock db as trx so insert mocks work
  (db as unknown as { transaction: () => unknown }).transaction = vi.fn().mockReturnValue({
    execute: (fn: (trx: typeof db) => Promise<unknown>) => fn(db),
  });

  return db;
}

describe("importCv — assignments", () => {
  it("creates assignment from valid period", async () => {
    const db = buildDb();
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    expect(result.assignmentsCreated).toBe(1);
    expect(result.assignmentsSkipped).toBe(0);
  });

  it("skips assignment with unparseable period", async () => {
    const db = buildDb();
    const cv = {
      ...BASE_CV_JSON,
      assignments: [{ ...BASE_CV_JSON.assignments[0]!, period: "not a period" }],
    };
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: cv });
    expect(result.assignmentsSkipped).toBe(1);
    expect(result.assignmentsCreated).toBe(0);
  });

  it("skips assignment with empty period", async () => {
    const db = buildDb();
    const cv = {
      ...BASE_CV_JSON,
      assignments: [{ ...BASE_CV_JSON.assignments[0]!, period: "" }],
    };
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: cv });
    expect(result.assignmentsSkipped).toBe(1);
  });

  it("skips duplicate assignments", async () => {
    const db = buildDb({ existingAssignment: { id: "existing-id" } });
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    expect(result.assignmentsSkipped).toBe(1);
    expect(result.assignmentsCreated).toBe(0);
  });

  it("passes description directly to the assignment insert", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    // calls[0] = assignments identity insert, calls[1] = branch_assignments content insert
    const passedValues = db._mocks.insertValues.mock.calls[1]?.[0] as { description: string };
    expect(passedValues.description).toBe("Built things.\n\nImproved performance.");
  });

  it("uses 'Unknown' when client is empty", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    const cv = {
      ...BASE_CV_JSON,
      assignments: [{ ...BASE_CV_JSON.assignments[0]!, client: "   " }],
    };
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: cv });
    // calls[0] = assignments identity insert, calls[1] = branch_assignments content insert
    const passedValues = db._mocks.insertValues.mock.calls[1]?.[0] as { client_name: string };
    expect(passedValues.client_name).toBe("Unknown");
  });

  it("uses technologies array directly", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    // calls[0] = assignments identity insert, calls[1] = branch_assignments content insert
    const passedValues = db._mocks.insertValues.mock.calls[1]?.[0] as { technologies: string[] };
    expect(passedValues.technologies).toEqual(["TypeScript", "Node.js"]);
  });

  it("links new assignments to branch_assignments via transaction", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    // Find the branch_assignments insert call
    const branchAssignCall = db._mocks.insertValues.mock.calls.find(
      (call) => (call[0] as { branch_id?: string }).branch_id !== undefined
    )?.[0] as { branch_id: string; assignment_id: string } | undefined;
    expect(branchAssignCall?.branch_id).toBe(BRANCH_ID);
    expect(branchAssignCall?.assignment_id).toBeDefined();
  });
});

describe("importCv — education", () => {
  it("creates degree, certification, and language entries", async () => {
    const db = buildDb();
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    // 1 assignment + 1 degree + 1 cert + 2 languages = 5 inserts total
    expect(result.educationCreated).toBe(4);
    expect(result.educationSkipped).toBe(0);
  });

  it("skips duplicate education entries", async () => {
    // No assignments — all selectExecuteTakeFirst calls are for education
    const db = buildDb();
    // Clear the queue and always return a match (all edu records exist)
    db._mocks.selectExecuteTakeFirst.mockReset();
    db._mocks.selectExecuteTakeFirst.mockResolvedValue({ id: "edu-id" });
    const cv = { ...BASE_CV_JSON, assignments: [] };
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: cv });
    expect(result.educationCreated).toBe(0);
    expect(result.educationSkipped).toBe(4);
  });
});

describe("importCv — resume", () => {
  it("updates existing main resume when one exists and title is non-empty", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    const updateMock = (db as unknown as { updateTable: ReturnType<typeof vi.fn> }).updateTable;
    expect(updateMock).toHaveBeenCalledWith("resumes");
    expect(result.resumeCreated).toBe(false);
  });

  it("creates a new main resume when none exists", async () => {
    const db = buildDb({ mainResume: undefined });
    const result = await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    const insertMock = (db as unknown as { insertInto: ReturnType<typeof vi.fn> }).insertInto;
    expect(insertMock).toHaveBeenCalledWith("resumes");
    expect(result.resumeCreated).toBe(true);
  });

  it("does not set resume_id on assignment inserts", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON });
    const assignmentInsert = db._mocks.insertValues.mock.calls.find(
      (call) => (call[0] as { client_name?: string }).client_name !== undefined
    )?.[0] as Record<string, unknown> | undefined;
    expect(assignmentInsert).toBeDefined();
    expect(assignmentInsert?.resume_id).toBeUndefined();
  });

  it("skips title/presentation update when title and presentation are empty", async () => {
    const db = buildDb({ mainResume: MAIN_RESUME });
    const cv = {
      ...BASE_CV_JSON,
      consultant: { name: "Test", title: "", presentation: [] },
      assignments: [],
    };
    await importCv(db, { employeeId: EMP_ID, language: "en", cvJson: cv });
    const updateMock = (db as unknown as { updateTable: ReturnType<typeof vi.fn> }).updateTable;
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("createImportCvHandler", () => {
  it("returns result when authenticated", async () => {
    const db = buildDb();
    const handler = createImportCvHandler(db as unknown as Kysely<Database>);
    const result = await call(handler, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON }, {
      context: { user: { role: "admin", email: "a@example.com" } },
    });
    expect(result.assignmentsCreated).toBeGreaterThanOrEqual(0);
  });

  it("throws UNAUTHORIZED when no user in context", async () => {
    const db = buildDb();
    const handler = createImportCvHandler(db as unknown as Kysely<Database>);
    await expect(
      call(handler, { employeeId: EMP_ID, language: "en", cvJson: BASE_CV_JSON }, { context: {} })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ORPCError && err.code === "UNAUTHORIZED"
    );
  });
});
