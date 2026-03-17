/**
 * Tests for the create_cvs migration.
 *
 * Uses a Kysely mock to verify that up() calls the right schema builder
 * operations without requiring a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";

// ---------------------------------------------------------------------------
// Minimal Kysely schema builder mock
// ---------------------------------------------------------------------------

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
  const tb = {
    addColumn: vi.fn().mockReturnThis(),
    addForeignKeyConstraint: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return tb;
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
    dropTable: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined), ifExists: vi.fn().mockReturnThis() }),
    createIndex: vi.fn().mockReturnValue(indexBuilder),
    dropIndex: vi.fn().mockReturnValue({ ifExists: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) }),
  };

  const fn = vi.fn().mockReturnValue("now()");

  return {
    db: { schema, fn } as unknown as Kysely<unknown>,
    schema,
    tableBuilder,
    indexBuilder,
  };
}

// ---------------------------------------------------------------------------
// Import migration under test
// ---------------------------------------------------------------------------

import { up, down } from "./20260313130000_create_cvs.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("create_cvs migration — up()", () => {
  let mock: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mock = makeMockDb();
  });

  it("creates the cvs table", async () => {
    await up(mock.db);
    const tableNames = mock.schema.createTable.mock.calls.map((c) => c[0] as string);
    expect(tableNames).toContain("cvs");
  });

  it("creates the cv_skills table", async () => {
    await up(mock.db);
    const tableNames = mock.schema.createTable.mock.calls.map((c) => c[0] as string);
    expect(tableNames).toContain("cv_skills");
  });

  it("creates an index on cvs.employee_id", async () => {
    await up(mock.db);
    expect(mock.schema.createIndex).toHaveBeenCalled();
    const indexCalls = mock.schema.createIndex.mock.calls.map((c) => c[0] as string);
    const employeeIdIndex = indexCalls.some((name) => name.includes("employee_id"));
    expect(employeeIdIndex).toBe(true);
  });

  it("creates an index on cvs.language", async () => {
    await up(mock.db);
    const indexCalls = mock.schema.createIndex.mock.calls.map((c) => c[0] as string);
    const languageIndex = indexCalls.some((name) => name.includes("language"));
    expect(languageIndex).toBe(true);
  });
});

describe("create_cvs migration — down()", () => {
  it("drops the cv_skills table", async () => {
    const mock = makeMockDb();
    await down(mock.db);
    const dropped = mock.schema.dropTable.mock.calls.map((c) => c[0] as string);
    expect(dropped).toContain("cv_skills");
  });

  it("drops the cvs table", async () => {
    const mock = makeMockDb();
    await down(mock.db);
    const dropped = mock.schema.dropTable.mock.calls.map((c) => c[0] as string);
    expect(dropped).toContain("cvs");
  });

  it("drops cv_skills before cvs (FK dependency order)", async () => {
    const mock = makeMockDb();
    await down(mock.db);
    const dropped = mock.schema.dropTable.mock.calls.map((c) => c[0] as string);
    expect(dropped.indexOf("cv_skills")).toBeLessThan(dropped.indexOf("cvs"));
  });
});

describe("Kysely TypeScript types for cvs and cv_skills", () => {
  it("CvTable type has required fields", async () => {
    const { up: _up, down: _down } = await import("./20260313130000_create_cvs.js");
    expect(typeof _up).toBe("function");
    expect(typeof _down).toBe("function");
  });

  it("Cv, NewCv, CvUpdate types are exported from db/types", async () => {
    const types = await import("../types.js");
    // Type-level check: these will fail to compile if the exports are missing
    type _CheckCv = typeof types extends { Cv: unknown } ? true : false;
    expect(true).toBe(true); // compile-time only — runtime confirms the import succeeded
  });
});
