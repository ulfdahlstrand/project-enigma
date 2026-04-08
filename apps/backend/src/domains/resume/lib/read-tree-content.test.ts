/**
 * Unit tests for readTreeContent.
 *
 * readTreeContent reads all resume tree entries for a given tree_id and
 * assembles them into a ResumeCommitContent object — the same shape
 * returned by the legacy resume_commits.content JSON.
 *
 * PARITY guarantee: for any commit that has both a tree_id and a content
 * JSON, readTreeContent must return data that produces an identical diff
 * when compared. This is the validation gate for Phase 2 dual-write.
 */

import { describe, it, expect, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { readTreeContent } from "./read-tree-content.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TREE_ID = "550e8400-e29b-41d4-a716-446655440090";
const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440051";

const METADATA_ENTRY = { id: "e1", tree_id: TREE_ID, entry_type: "metadata", position: 0 };
const CONSULTANT_ENTRY = { id: "e2", tree_id: TREE_ID, entry_type: "consultant_title", position: 1 };
const PRESENTATION_ENTRY = { id: "e3", tree_id: TREE_ID, entry_type: "presentation", position: 2 };
const SUMMARY_ENTRY = { id: "e4", tree_id: TREE_ID, entry_type: "summary", position: 3 };
const HIGHLIGHTED_ENTRY = { id: "e5", tree_id: TREE_ID, entry_type: "highlighted_items", position: 4 };
const SKILL_GROUP_ENTRY = { id: "e6", tree_id: TREE_ID, entry_type: "skill_group", position: 5 };
const SKILL_ENTRY = { id: "e7", tree_id: TREE_ID, entry_type: "skill", position: 6 };
const ASSIGNMENT_ENTRY = { id: "e8", tree_id: TREE_ID, entry_type: "assignment", position: 7 };

const ALL_ENTRIES = [
  METADATA_ENTRY,
  CONSULTANT_ENTRY,
  PRESENTATION_ENTRY,
  SUMMARY_ENTRY,
  HIGHLIGHTED_ENTRY,
  SKILL_GROUP_ENTRY,
  SKILL_ENTRY,
  ASSIGNMENT_ENTRY,
];

const ENTRY_CONTENT_MAP: Record<string, { revision_id: string; revision_type: string }> = {
  e1: { revision_id: "r1", revision_type: "resume_metadata_revisions" },
  e2: { revision_id: "r2", revision_type: "consultant_title_revisions" },
  e3: { revision_id: "r3", revision_type: "presentation_revisions" },
  e4: { revision_id: "r4", revision_type: "summary_revisions" },
  e5: { revision_id: "r5", revision_type: "highlighted_item_revisions" },
  e6: { revision_id: "r6", revision_type: "skill_group_revisions" },
  e7: { revision_id: "r7", revision_type: "skill_revisions" },
  e8: { revision_id: "r8", revision_type: "assignment_revisions" },
};

const REVISION_DATA: Record<string, unknown> = {
  r1: { id: "r1", title: "Senior Engineer", language: "en" },
  r2: { id: "r2", value: "Principal Consultant" },
  r3: { id: "r3", paragraphs: ["Experienced engineer"] },
  r4: { id: "r4", content: "Strong backend focus" },
  r5: { id: "r5", items: ["Led platform rewrite"] },
  r6: { id: "r6", name: "Languages", sort_order: 0 },
  r7: { id: "r7", name: "TypeScript", group_revision_id: "r6", sort_order: 0 },
  r8: {
    id: "r8",
    assignment_id: ASSIGNMENT_ID,
    client_name: "ACME Corp",
    role: "Backend Engineer",
    description: "Built APIs",
    technologies: ["Node.js"],
    start_date: new Date("2023-01-01"),
    end_date: null,
    is_current: true,
    sort_order: 0,
  },
};

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function buildDbMock(opts: {
  entries?: typeof ALL_ENTRIES;
  entryContentMap?: typeof ENTRY_CONTENT_MAP;
  revisionData?: typeof REVISION_DATA;
} = {}) {
  const {
    entries = ALL_ENTRIES,
    entryContentMap = ENTRY_CONTENT_MAP,
    revisionData = REVISION_DATA,
  } = opts;

  const selectFrom = vi.fn().mockImplementation((table: string) => {
    const makeChain = (rows: unknown[]) => ({
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(rows) }),
          execute: vi.fn().mockResolvedValue(rows),
          executeTakeFirst: vi.fn().mockResolvedValue(rows[0]),
        }),
        execute: vi.fn().mockResolvedValue(rows),
        executeTakeFirst: vi.fn().mockResolvedValue(rows[0]),
      }),
      where: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(rows) }),
          execute: vi.fn().mockResolvedValue(rows),
          executeTakeFirst: vi.fn().mockResolvedValue(rows[0]),
        }),
        execute: vi.fn().mockResolvedValue(rows),
        executeTakeFirst: vi.fn().mockResolvedValue(rows[0]),
      }),
    });

    if (table === "resume_tree_entries") return makeChain(entries);

    if (table === "resume_tree_entry_content") {
      // Return content row based on entry_id passed in where()
      return {
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation((_col: string, _op: string, entryId: string) => ({
            executeTakeFirst: vi.fn().mockResolvedValue(entryContentMap[entryId]),
          })),
        }),
        where: vi.fn().mockImplementation((_col: string, _op: string, entryId: string) => ({
          select: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue(entryContentMap[entryId]),
          }),
          executeTakeFirst: vi.fn().mockResolvedValue(entryContentMap[entryId]),
        })),
      };
    }

    // Revision tables — return revision by id
    return {
      select: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((_col: string, _op: string, revId: string) => ({
          executeTakeFirst: vi.fn().mockResolvedValue(revisionData[revId]),
        })),
      }),
      where: vi.fn().mockImplementation((_col: string, _op: string, revId: string) => ({
        select: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(revisionData[revId]),
        }),
        executeTakeFirst: vi.fn().mockResolvedValue(revisionData[revId]),
      })),
    };
  });

  return { db: { selectFrom } as unknown as Kysely<Database> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("readTreeContent", () => {
  it("returns a ResumeCommitContent-shaped object", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);

    expect(result).toMatchObject({
      title: expect.any(String),
      language: expect.any(String),
      presentation: expect.any(Array),
      highlightedItems: expect.any(Array),
      skillGroups: expect.any(Array),
      skills: expect.any(Array),
      assignments: expect.any(Array),
    });
  });

  it("PARITY: title comes from metadata revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.title).toBe("Senior Engineer");
  });

  it("PARITY: language comes from metadata revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.language).toBe("en");
  });

  it("PARITY: consultantTitle comes from consultant_title revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.consultantTitle).toBe("Principal Consultant");
  });

  it("PARITY: presentation comes from presentation revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.presentation).toEqual(["Experienced engineer"]);
  });

  it("PARITY: summary comes from summary revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.summary).toBe("Strong backend focus");
  });

  it("PARITY: highlightedItems comes from highlighted_item revision", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.highlightedItems).toEqual(["Led platform rewrite"]);
  });

  it("PARITY: skillGroups comes from skill_group revisions", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.skillGroups).toHaveLength(1);
    expect(result.skillGroups[0]).toMatchObject({ name: "Languages", sortOrder: 0 });
  });

  it("PARITY: skills comes from skill revisions", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toMatchObject({ name: "TypeScript", sortOrder: 0 });
  });

  it("PARITY: assignments comes from assignment revisions", async () => {
    const { db } = buildDbMock();
    const result = await readTreeContent(db, TREE_ID);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      assignmentId: ASSIGNMENT_ID,
      clientName: "ACME Corp",
      role: "Backend Engineer",
    });
  });

  it("returns null consultantTitle when no consultant_title entry exists", async () => {
    const { db } = buildDbMock({
      entries: ALL_ENTRIES.filter((e) => e.entry_type !== "consultant_title"),
    });
    const result = await readTreeContent(db, TREE_ID);
    expect(result.consultantTitle).toBeNull();
  });

  it("returns null summary when no summary entry exists", async () => {
    const { db } = buildDbMock({
      entries: ALL_ENTRIES.filter((e) => e.entry_type !== "summary"),
    });
    const result = await readTreeContent(db, TREE_ID);
    expect(result.summary).toBeNull();
  });

  it("returns empty arrays when no skill/assignment entries exist", async () => {
    const { db } = buildDbMock({
      entries: ALL_ENTRIES.filter(
        (e) => !["skill_group", "skill", "assignment"].includes(e.entry_type)
      ),
    });
    const result = await readTreeContent(db, TREE_ID);
    expect(result.skillGroups).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.assignments).toEqual([]);
  });
});
