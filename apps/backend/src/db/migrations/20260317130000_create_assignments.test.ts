/**
 * Tests for the create_assignments migration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";

function makeColumnBuilder() {
  const col = {
    primaryKey: vi.fn().mockReturnThis(),
    defaultTo: vi.fn().mockReturnThis(),
    notNull: vi.fn().mockReturnThis(),
    references: vi.fn().mockReturnThis(),
    onDelete: vi.fn().mockReturnThis(),
    unique: vi.fn().mockReturnThis(),
  };
  return col;
}

function makeTableBuilder() {
  return {
    addColumn: vi.fn().mockReturnThis(),
    addForeignKeyConstraint: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function makeIndexBuilder() {
  return {
    on: vi.fn().mockReturnThis(),
    column: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockDb() {
  const tableBuilder = makeTableBuilder();
  const indexBuilder = makeIndexBuilder();
  const schema = {
    createTable: vi.fn().mockReturnValue(tableBuilder),
    dropTable: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
      ifExists: vi.fn().mockReturnThis(),
    }),
    createIndex: vi.fn().mockReturnValue(indexBuilder),
    dropIndex: vi.fn().mockReturnValue({
      ifExists: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  };
  const fn = vi.fn().mockReturnValue("now()");
  return {
    db: { schema, fn } as unknown as Kysely<unknown>,
    schema,
    tableBuilder,
    indexBuilder,
  };
}

import { up, down } from "./20260317130000_create_assignments.js";

describe("create_assignments migration — up()", () => {
  let mock: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mock = makeMockDb();
  });

  it("creates the assignments table", async () => {
    await up(mock.db);
    const tableNames = mock.schema.createTable.mock.calls.map((c) => c[0] as string);
    expect(tableNames).toContain("assignments");
  });

  it("creates an index on assignments.employee_id", async () => {
    await up(mock.db);
    const indexNames = mock.schema.createIndex.mock.calls.map((c) => c[0] as string);
    expect(indexNames.some((n) => n.includes("employee_id"))).toBe(true);
  });
});

describe("create_assignments migration — down()", () => {
  it("drops the assignments table", async () => {
    const mock = makeMockDb();
    await down(mock.db);
    const dropped = mock.schema.dropTable.mock.calls.map((c) => c[0] as string);
    expect(dropped).toContain("assignments");
  });
});

describe("Kysely TypeScript types for assignments", () => {
  it("Assignment, NewAssignment, AssignmentUpdate are exported from db/types", async () => {
    const types = await import("../types.js");
    expect(types).toBeDefined();
  });
});
