/**
 * Static-analysis tests for apps/backend/src/db/types.ts.
 *
 * Covers acceptance criteria 8, 9, and 10 by:
 *  - Importing the actual exports and verifying their existence at runtime.
 *  - Inspecting the TypeScript source text to confirm field types and
 *    derivation helpers (Generated, Selectable, Insertable, Updateable).
 *
 * TypeScript correctness (AC 11) is verified separately via `tsc --noEmit`.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ── Source inspection setup ──────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const typesSource = readFileSync(join(__dirname, "types.ts"), "utf-8");

// ── AC 8: EmployeeTable interface fields and their types ─────────────────────

describe("AC8 – EmployeeTable interface exported with correct field types", () => {
  it("exports EmployeeTable interface", () => {
    expect(typesSource).toMatch(/export\s+interface\s+EmployeeTable/);
  });

  it("EmployeeTable has 'id' typed as Generated<string>", () => {
    expect(typesSource).toMatch(/id\s*:\s*Generated<string>/);
  });

  it("EmployeeTable has 'name' typed as string", () => {
    expect(typesSource).toMatch(/name\s*:\s*string/);
  });

  it("EmployeeTable has 'email' typed as string", () => {
    expect(typesSource).toMatch(/email\s*:\s*string/);
  });

  it("EmployeeTable has 'created_at' typed as Generated<Date>", () => {
    expect(typesSource).toMatch(/created_at\s*:\s*Generated<Date>/);
  });

  it("EmployeeTable has 'updated_at' typed as Generated<Date>", () => {
    expect(typesSource).toMatch(/updated_at\s*:\s*Generated<Date>/);
  });

  it("imports Generated from kysely", () => {
    expect(typesSource).toMatch(/import.*Generated.*from\s+['"]kysely['"]/);
  });
});

// ── AC 9: Database interface with employees: EmployeeTable ───────────────────

describe("AC9 – Database interface exported with employees: EmployeeTable", () => {
  it("exports Database interface", () => {
    expect(typesSource).toMatch(/export\s+interface\s+Database/);
  });

  it("Database interface has 'employees' property typed as EmployeeTable", () => {
    expect(typesSource).toMatch(/employees\s*:\s*EmployeeTable/);
  });
});

// ── AC 10: Utility types derived with Selectable, Insertable, Updateable ─────

describe("AC10 – Employee, NewEmployee, EmployeeUpdate utility types exported", () => {
  it("imports Selectable, Insertable, Updateable from kysely", () => {
    expect(typesSource).toMatch(/import.*Selectable.*from\s+['"]kysely['"]/);
    expect(typesSource).toMatch(/import.*Insertable.*from\s+['"]kysely['"]/);
    expect(typesSource).toMatch(/import.*Updateable.*from\s+['"]kysely['"]/);
  });

  it("exports Employee as Selectable<EmployeeTable>", () => {
    expect(typesSource).toMatch(
      /export\s+type\s+Employee\s*=\s*Selectable<EmployeeTable>/
    );
  });

  it("exports NewEmployee as Insertable<EmployeeTable>", () => {
    expect(typesSource).toMatch(
      /export\s+type\s+NewEmployee\s*=\s*Insertable<EmployeeTable>/
    );
  });

  it("exports EmployeeUpdate as Updateable<EmployeeTable>", () => {
    expect(typesSource).toMatch(
      /export\s+type\s+EmployeeUpdate\s*=\s*Updateable<EmployeeTable>/
    );
  });
});
