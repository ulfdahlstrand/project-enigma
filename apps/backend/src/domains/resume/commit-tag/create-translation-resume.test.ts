import { describe, it, expect, vi } from "vitest";
import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { createTranslationResume } from "./create-translation-resume.js";
import { MOCK_ADMIN, MOCK_CONSULTANT } from "../../../test-helpers/mock-users.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const SOURCE_RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const SOURCE_TREE_ID = "550e8400-e29b-41d4-a716-446655440081";
const NEW_RESUME_ID = "550e8400-e29b-41d4-a716-446655440031";
const NEW_BRANCH_ID = "550e8400-e29b-41d4-a716-446655440041";
const NEW_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440062";
const NEW_TREE_ID = "550e8400-e29b-41d4-a716-446655440082";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440071";

const SOURCE_CONTENT = {
  title: "My CV",
  consultantTitle: null,
  presentation: [],
  summary: null,
  highlightedItems: [],
  language: "sv",
  education: [],
  skillGroups: [],
  skills: [],
  assignments: [],
};

vi.mock("../lib/read-tree-content.js", () => ({
  readTreeContent: vi.fn().mockResolvedValue({
    title: "My CV",
    consultantTitle: null,
    presentation: [],
    summary: null,
    highlightedItems: [],
    language: "sv",
    education: [],
    skillGroups: [],
    skills: [],
    assignments: [],
  }),
}));

vi.mock("../lib/build-commit-tree.js", () => ({
  buildCommitTree: vi.fn().mockResolvedValue("550e8400-e29b-41d4-a716-446655440082"),
}));

function makeTransactionMock(mocks: {
  newResume: object;
  newBranch: object;
  rootCommit: object;
  tag: object;
}) {
  let insertCallCount = 0;
  const insertResults = [mocks.newResume, mocks.newBranch, mocks.rootCommit, mocks.tag];

  return {
    insertInto: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockImplementation(() =>
        Promise.resolve(insertResults[insertCallCount++])
      ),
    })),
    updateTable: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    })),
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockDb(opts: {
  sourceResume?: { id: string; employee_id: string; title: string } | null;
  sourceBranch?: { head_commit_id: string } | null;
  sourceCommit?: { id: string; tree_id: string } | null;
  /**
   * Pass an employeeId string to simulate a consultant whose employee row
   * has that id. Leave undefined to use MOCK_ADMIN (no DB call needed).
   */
  consultantEmployeeId?: string;
} = {}): Kysely<Database> {
  const sourceResume = opts.sourceResume === null
    ? undefined
    : (opts.sourceResume ?? { id: SOURCE_RESUME_ID, employee_id: EMPLOYEE_ID, title: "My CV" });
  const sourceBranch = opts.sourceBranch === null
    ? undefined
    : (opts.sourceBranch ?? { head_commit_id: SOURCE_COMMIT_ID });
  const sourceCommit = opts.sourceCommit === null
    ? undefined
    : (opts.sourceCommit ?? { id: SOURCE_COMMIT_ID, tree_id: SOURCE_TREE_ID });

  // For consultants, resolveEmployeeId makes a DB call (returns { id: consultantEmployeeId })
  // For admins, resolveEmployeeId returns null immediately (no DB call)
  const selectResults = opts.consultantEmployeeId
    ? [{ id: opts.consultantEmployeeId }, sourceResume, sourceBranch, sourceCommit]
    : [sourceResume, sourceBranch, sourceCommit];
  let selectCallCount = 0;

  const trxMock = makeTransactionMock({
    newResume: { id: NEW_RESUME_ID, employee_id: EMPLOYEE_ID, title: "My CV" },
    newBranch: { id: NEW_BRANCH_ID, resume_id: NEW_RESUME_ID },
    rootCommit: { id: NEW_COMMIT_ID, tree_id: NEW_TREE_ID },
    tag: { id: TAG_ID },
  });

  return {
    selectFrom: vi.fn().mockImplementation(() => ({
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockImplementation(() =>
        Promise.resolve(selectResults[selectCallCount++])
      ),
    })),
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation((fn: (trx: unknown) => Promise<unknown>) =>
        fn(trxMock)
      ),
    }),
  } as unknown as Kysely<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createTranslationResume", () => {
  it("creates a new resume and commit tag, returns ids", async () => {
    const db = makeMockDb();
    const result = await createTranslationResume(db, MOCK_ADMIN, {
      sourceResumeId: SOURCE_RESUME_ID,
      targetLanguage: "en",
    });

    expect(result).toEqual({ resumeId: NEW_RESUME_ID, commitTagId: TAG_ID });
  });

  it("throws NOT_FOUND when source resume does not exist", async () => {
    const db = makeMockDb({ sourceResume: null });
    await expect(
      createTranslationResume(db, MOCK_ADMIN, {
        sourceResumeId: SOURCE_RESUME_ID,
        targetLanguage: "en",
      })
    ).rejects.toThrow(ORPCError);
  });

  it("throws FORBIDDEN when consultant accesses another employee's resume", async () => {
    const otherEmployeeId = "550e8400-e29b-41d4-a716-446655440099";
    // Consultant's employee ID is otherEmployeeId, but resume.employee_id is EMPLOYEE_ID
    const db = makeMockDb({ consultantEmployeeId: otherEmployeeId });
    await expect(
      createTranslationResume(db, MOCK_CONSULTANT, {
        sourceResumeId: SOURCE_RESUME_ID,
        targetLanguage: "en",
      })
    ).rejects.toThrow(ORPCError);
  });

  it("throws BAD_REQUEST when source resume has no commits", async () => {
    const db = makeMockDb({ sourceBranch: null });
    await expect(
      createTranslationResume(db, MOCK_ADMIN, {
        sourceResumeId: SOURCE_RESUME_ID,
        targetLanguage: "en",
      })
    ).rejects.toThrow(ORPCError);
  });

  it("uses provided name as the new resume title", async () => {
    const db = makeMockDb();
    const result = await createTranslationResume(db, MOCK_ADMIN, {
      sourceResumeId: SOURCE_RESUME_ID,
      targetLanguage: "en",
      name: "English CV",
    });

    expect(result.resumeId).toBe(NEW_RESUME_ID);
  });
});
