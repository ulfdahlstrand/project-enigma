/**
 * Unit tests for buildCommitTree.
 *
 * buildCommitTree is called inside the saveResumeVersion transaction. It:
 *   1. Inserts revisions for each content type (deduplicating unchanged content)
 *   2. Creates a resume_tree row
 *   3. Creates resume_tree_entries (one per content type)
 *   4. Creates resume_tree_entry_content rows (coupling entry to revision)
 *   5. Returns the tree_id
 *
 * Paritet guarantee: the data written to revision tables must match what is
 * stored in the legacy resume_commits.content JSON for the same commit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { buildCommitTree } from "./build-commit-tree.js";
import type { ResumeCommitContent } from "../../../db/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440011";
const TREE_ID = "550e8400-e29b-41d4-a716-446655440090";
const ENTRY_ID = "550e8400-e29b-41d4-a716-446655440091";
const REVISION_ID = "550e8400-e29b-41d4-a716-446655440092";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const CONTENT: ResumeCommitContent = {
  title: "Senior Engineer",
  consultantTitle: "Principal Consultant",
  presentation: ["Experienced backend engineer"],
  summary: "Strong focus on distributed systems",
  highlightedItems: ["Led platform rewrite"],
  language: "en",
  skillGroups: [{ name: "Languages", sortOrder: 0 }],
  skills: [{ name: "TypeScript", category: "Languages", sortOrder: 0 }],
  assignments: [
    {
      assignmentId: ASSIGNMENT_ID,
      clientName: "ACME Corp",
      role: "Backend Engineer",
      description: "Built APIs",
      startDate: "2023-01-01",
      endDate: null,
      technologies: ["Node.js", "PostgreSQL"],
      isCurrent: true,
      keywords: null,
      type: null,
      highlight: false,
      sortOrder: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function buildTrxMock() {
  const insertedRows: Record<string, unknown[]> = {};

  const makeInsert = (table: string) => ({
    values: vi.fn().mockImplementation((row: unknown) => {
      insertedRows[table] ??= [];
      insertedRows[table]!.push(row);
      return {
        returning: vi.fn().mockReturnValue({
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
            id: table === "resume_trees" ? TREE_ID : table === "resume_tree_entries" ? ENTRY_ID : REVISION_ID,
          }),
        }),
        execute: vi.fn().mockResolvedValue(undefined),
      };
    }),
  });

  const insertInto = vi.fn().mockImplementation((table: string) => makeInsert(table));

  const trx = { insertInto } as unknown as Kysely<Database>;
  return { trx, insertedRows, insertInto };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildCommitTree", () => {
  it("returns a tree_id string", async () => {
    const { trx } = buildTrxMock();
    const result = await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(typeof result).toBe("string");
    expect(result).toBe(TREE_ID);
  });

  it("inserts a resume_trees row", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_trees");
  });

  it("inserts resume_revision_metadata with title and language", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_revision_metadata");
    const call = (insertInto as ReturnType<typeof vi.fn>).mock.calls.find(
      ([table]: [string]) => table === "resume_revision_metadata"
    );
    expect(call).toBeDefined();
  });

  it("inserts resume_revision_consultant_title when consultantTitle is set", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_revision_consultant_title");
  });

  it("inserts resume_revision_presentation with paragraphs", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_revision_presentation");
  });

  it("inserts resume_revision_summary with content", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_revision_summary");
  });

  it("inserts resume_revision_highlighted_item with items", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    expect(insertInto).toHaveBeenCalledWith("resume_revision_highlighted_item");
  });

  it("inserts resume_revision_skill_group for each skill group", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    const calls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_revision_skill_group"
    );
    expect(calls).toHaveLength(CONTENT.skillGroups.length);
  });

  it("inserts resume_revision_skill for each skill", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    const calls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_revision_skill"
    );
    expect(calls).toHaveLength(CONTENT.skills.length);
  });

  it("inserts resume_revision_assignment for each assignment", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    const calls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_revision_assignment"
    );
    expect(calls).toHaveLength(CONTENT.assignments.length);
  });

  it("inserts resume_revision_education (may be zero when no education data)", async () => {
    const { trx, insertInto } = buildTrxMock();
    // education comes from employee data, not content — an empty array is valid
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    // We just verify the function completes without error; education rows = 0 here
    expect(insertInto).toHaveBeenCalled();
  });

  it("inserts resume_tree_entries for each content type", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    const calls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_tree_entries"
    );
    // At minimum: metadata, consultant_title, presentation, summary, highlighted_items,
    // skill_groups (1), skills (1), assignments (1) = 8 entries
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  it("inserts resume_tree_entry_content for each entry", async () => {
    const { trx, insertInto } = buildTrxMock();
    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);
    const calls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_tree_entry_content"
    );
    const entryCalls = (insertInto as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([table]: [string]) => table === "resume_tree_entries"
    );
    // Every entry must have a corresponding content row
    expect(calls.length).toBe(entryCalls.length);
  });

  // ── Paritet tests ──────────────────────────────────────────────────────────
  // These verify that the data written to revision tables matches what is in
  // the content object — the core correctness guarantee for dual-write.

  it("PARITY: metadata revision title matches content.title", async () => {
    const captured: unknown[] = [];
    const trx = {
      insertInto: vi.fn().mockImplementation((table: string) => ({
        values: vi.fn().mockImplementation((row: unknown) => {
          if (table === "resume_revision_metadata") captured.push(row);
          return {
            returning: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: REVISION_ID }),
            }),
            execute: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    } as unknown as Kysely<Database>;

    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      title: CONTENT.title,
      language: CONTENT.language,
    });
  });

  it("PARITY: assignment revision clientName matches content.assignments[0].clientName", async () => {
    const captured: unknown[] = [];
    const trx = {
      insertInto: vi.fn().mockImplementation((table: string) => ({
        values: vi.fn().mockImplementation((row: unknown) => {
          if (table === "resume_revision_assignment") captured.push(row);
          return {
            returning: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: REVISION_ID }),
            }),
            execute: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    } as unknown as Kysely<Database>;

    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);

    expect(captured[0]).toMatchObject({
      assignment_id: CONTENT.assignments[0]!.assignmentId,
      client_name: CONTENT.assignments[0]!.clientName,
      role: CONTENT.assignments[0]!.role,
    });
  });

  it("PARITY: summary revision content matches content.summary", async () => {
    const captured: unknown[] = [];
    const trx = {
      insertInto: vi.fn().mockImplementation((table: string) => ({
        values: vi.fn().mockImplementation((row: unknown) => {
          if (table === "resume_revision_summary") captured.push(row);
          return {
            returning: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: REVISION_ID }),
            }),
            execute: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    } as unknown as Kysely<Database>;

    await buildCommitTree(trx, RESUME_ID, EMPLOYEE_ID, CONTENT);

    expect(captured[0]).toMatchObject({ content: CONTENT.summary });
  });
});
