/**
 * Tester acceptance-criteria tests for Task #63
 *
 * Covers criteria 1–5, 7, 11, 12 via static/structural inspection.
 * Criteria 6, 9, 10 are covered by list-employees.test.ts (developer test file).
 * Criteria 3, 8   are TypeScript compilation checks run separately (tsc --noEmit).
 *
 * All tests are purely structural — they import modules and inspect their shape,
 * call no external services, and need no database.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Criterion 1 & 2 — employeeSchema and listEmployeesOutputSchema from contracts
// ---------------------------------------------------------------------------

import {
  employeeSchema,
  listEmployeesOutputSchema,
} from "@cv-tool/contracts";

describe("Criterion 1 — employeeSchema exported from @cv-tool/contracts with required fields", () => {
  it("employeeSchema is a ZodObject", () => {
    expect(employeeSchema).toBeInstanceOf(z.ZodObject);
  });

  it("employeeSchema has field: id (string uuid)", () => {
    const shape = employeeSchema.shape;
    expect(shape).toHaveProperty("id");
    // uuid() wraps a ZodString with a check
    const idSchema = shape.id;
    expect(idSchema).toBeInstanceOf(z.ZodString);
    // Validate that a valid UUID passes and a non-UUID fails
    expect(idSchema.safeParse("550e8400-e29b-41d4-a716-446655440001").success).toBe(true);
    expect(idSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("employeeSchema has field: name (string)", () => {
    const shape = employeeSchema.shape;
    expect(shape).toHaveProperty("name");
    expect(shape.name).toBeInstanceOf(z.ZodString);
  });

  it("employeeSchema has field: email (string)", () => {
    const shape = employeeSchema.shape;
    expect(shape).toHaveProperty("email");
    expect(shape.email).toBeInstanceOf(z.ZodString);
  });

  it("employeeSchema has field: created_at (accepts string)", () => {
    const shape = employeeSchema.shape;
    expect(shape).toHaveProperty("created_at");
    const schema = shape.created_at;
    expect(schema.safeParse("2025-01-01T00:00:00.000Z").success).toBe(true);
  });

  it("employeeSchema has field: created_at (accepts Date)", () => {
    const shape = employeeSchema.shape;
    const schema = shape.created_at;
    expect(schema.safeParse(new Date("2025-01-01T00:00:00.000Z")).success).toBe(true);
  });

  it("employeeSchema has field: updated_at (accepts string)", () => {
    const shape = employeeSchema.shape;
    expect(shape).toHaveProperty("updated_at");
    const schema = shape.updated_at;
    expect(schema.safeParse("2025-01-01T00:00:00.000Z").success).toBe(true);
  });

  it("employeeSchema has field: updated_at (accepts Date)", () => {
    const shape = employeeSchema.shape;
    const schema = shape.updated_at;
    expect(schema.safeParse(new Date("2025-01-01T00:00:00.000Z")).success).toBe(true);
  });

  it("employeeSchema does NOT have a 'role' field (matches Task #61 DB schema)", () => {
    const shape = employeeSchema.shape;
    expect(shape).not.toHaveProperty("role");
  });

  it("a valid employee object with Date timestamps passes employeeSchema", () => {
    const result = employeeSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Alice Smith",
      email: "alice@example.com",
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("a valid employee object with string timestamps passes employeeSchema", () => {
    const result = employeeSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Alice Smith",
      email: "alice@example.com",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("Criterion 2 — listEmployeesOutputSchema is z.array(employeeSchema)", () => {
  it("listEmployeesOutputSchema is a ZodArray", () => {
    expect(listEmployeesOutputSchema).toBeInstanceOf(z.ZodArray);
  });

  it("listEmployeesOutputSchema element type is employeeSchema", () => {
    expect(listEmployeesOutputSchema.element).toBe(employeeSchema);
  });

  it("listEmployeesOutputSchema parses an empty array", () => {
    expect(listEmployeesOutputSchema.safeParse([]).success).toBe(true);
  });

  it("listEmployeesOutputSchema parses an array of valid employees (Date timestamps)", () => {
    const result = listEmployeesOutputSchema.safeParse([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Alice",
        email: "alice@example.com",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("listEmployeesOutputSchema parses an array of valid employees (string timestamps)", () => {
    const result = listEmployeesOutputSchema.safeParse([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Alice",
        email: "alice@example.com",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("listEmployeesOutputSchema rejects a non-array", () => {
    expect(listEmployeesOutputSchema.safeParse("not-an-array").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 — re-exports from @cv-tool/contracts package entry point
// ---------------------------------------------------------------------------

describe("Criterion 4 — employeeSchema and listEmployeesOutputSchema re-exported from @cv-tool/contracts entry point", () => {
  it("employeeSchema is importable from '@cv-tool/contracts'", async () => {
    const contracts = await import("@cv-tool/contracts");
    expect(contracts).toHaveProperty("employeeSchema");
    expect(contracts.employeeSchema).toBeDefined();
  });

  it("listEmployeesOutputSchema is importable from '@cv-tool/contracts'", async () => {
    const contracts = await import("@cv-tool/contracts");
    expect(contracts).toHaveProperty("listEmployeesOutputSchema");
    expect(contracts.listEmployeesOutputSchema).toBeDefined();
  });

  it("both are the same references as the direct named imports", async () => {
    const contracts = await import("@cv-tool/contracts");
    expect(contracts.employeeSchema).toBe(employeeSchema);
    expect(contracts.listEmployeesOutputSchema).toBe(listEmployeesOutputSchema);
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 — listEmployees registered on the oRPC router
// ---------------------------------------------------------------------------

describe("Criterion 5 — listEmployees procedure registered on the backend oRPC router", () => {
  it("router has a 'listEmployees' property", async () => {
    const { router } = await import("../router.js");
    expect(router).toHaveProperty("listEmployees");
    expect((router as Record<string, unknown>)["listEmployees"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Criterion 7 — procedure output schema declared as listEmployeesOutputSchema
// ---------------------------------------------------------------------------

describe("Criterion 7 — listEmployees procedure declares output schema as listEmployeesOutputSchema", () => {
  it("contract.listEmployees output schema is listEmployeesOutputSchema", async () => {
    const { contract } = await import("@cv-tool/contracts");
    // Access the oRPC contract route definition
    const listEmployeesContract = (contract as Record<string, unknown>)["listEmployees"];
    expect(listEmployeesContract).toBeDefined();
    // The oRPC contract object exposes ~orpc with outputSchema
    const orpcMeta = (listEmployeesContract as Record<string, unknown>)["~orpc"];
    expect(orpcMeta).toBeDefined();
    const outputSchema = (orpcMeta as Record<string, unknown>)["outputSchema"];
    expect(outputSchema).toBe(listEmployeesOutputSchema);
  });
});

// ---------------------------------------------------------------------------
// Criterion 11 — No create, update, or delete procedures introduced
// ---------------------------------------------------------------------------

describe("Criterion 11 — no create/update/delete employee procedures introduced", () => {
  it("router does not have 'createEmployee' procedure", async () => {
    const { router } = await import("../router.js");
    expect(router).not.toHaveProperty("createEmployee");
  });

  it("router does not have 'updateEmployee' procedure", async () => {
    const { router } = await import("../router.js");
    expect(router).not.toHaveProperty("updateEmployee");
  });

  it("router does not have 'deleteEmployee' procedure", async () => {
    const { router } = await import("../router.js");
    expect(router).not.toHaveProperty("deleteEmployee");
  });

  it("contract does not have 'createEmployee' procedure", async () => {
    const { contract } = await import("@cv-tool/contracts");
    expect(contract).not.toHaveProperty("createEmployee");
  });

  it("contract does not have 'updateEmployee' procedure", async () => {
    const { contract } = await import("@cv-tool/contracts");
    expect(contract).not.toHaveProperty("updateEmployee");
  });

  it("contract does not have 'deleteEmployee' procedure", async () => {
    const { contract } = await import("@cv-tool/contracts");
    expect(contract).not.toHaveProperty("deleteEmployee");
  });
});

// ---------------------------------------------------------------------------
// Criterion 12 — no cross-app imports from apps/frontend/ in backend source
// ---------------------------------------------------------------------------

describe("Criterion 12 — backend source files do not import from apps/frontend/", () => {
  // Resolve the backend src directory relative to the monorepo root.
  // This test file lives at: apps/backend/src/procedures/list-employees.criteria.test.ts
  // We need:               apps/backend/src/
  const __filename = fileURLToPath(import.meta.url);
  // __filename → <root>/apps/backend/src/procedures/list-employees.criteria.test.ts
  // dirname    → <root>/apps/backend/src/procedures
  // up one    → <root>/apps/backend/src
  const backendSrcDir = path.resolve(path.dirname(__filename), "..");

  /**
   * Recursively collect all .ts / .tsx files under a directory.
   */
  function collectTsFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTsFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("backendSrcDir resolves to an existing directory", () => {
    expect(fs.existsSync(backendSrcDir)).toBe(true);
    expect(fs.statSync(backendSrcDir).isDirectory()).toBe(true);
  });

  it("no .ts file in apps/backend/src/ contains an import from apps/frontend/", () => {
    const tsFiles = collectTsFiles(backendSrcDir);
    expect(tsFiles.length).toBeGreaterThan(0); // sanity: we found files

    const violations: string[] = [];
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Match any import/require referencing apps/frontend or relative paths that
      // would resolve into it. Patterns checked:
      //   1. Absolute-looking path containing "apps/frontend"
      //   2. Relative paths escaping backend into frontend (../../frontend, ../../../frontend, etc.)
      const frontendImportPattern =
        /from\s+['"][^'"]*apps\/frontend[^'"]*['"]|require\s*\(\s*['"][^'"]*apps\/frontend[^'"]*['"]\s*\)|from\s+['"]\.\.\/[./]*frontend[^'"]*['"]/;
      if (frontendImportPattern.test(content)) {
        violations.push(path.relative(backendSrcDir, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
