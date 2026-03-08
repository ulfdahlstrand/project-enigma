# Recipe: Adding a Backend oRPC Read Procedure

## When to Use

When adding a new read (`list*` or `get*`) procedure to the backend: defining its Zod
schemas in `@cv-tool/contracts`, implementing the handler with Kysely, registering it on
the oRPC router, and writing a co-located Vitest unit test.

This recipe covers the full vertical slice: contracts → DB types → procedure handler →
router registration → unit test. Use it for every new domain entity or query exposed
through the API.

---

## Context / Background

- **ADR-012** — Kysely is the sole database client. No raw SQL, no other ORMs.
- **ADR-011** — Vitest is the sole test runner; co-located test files; DI via `vi.fn()`.
- **`docs/arch/backend.md`** — Procedure pattern, Kysely instance, DB type conventions.
- **`docs/arch/testing.md`** — Co-located tests, no `__tests__/` dirs, `vi.fn()` mocking.

**The `getDb()` lazy singleton is intentional.** `client.ts` exports a *getter*
(`getDb()`), not a named `db` const, so that `DATABASE_URL` is never read at import time.
This keeps unit tests free of connection errors even when no environment variable is set.

---

## Steps

### 1 — Define Zod schemas in `@cv-tool/contracts`

Create (or extend) `packages/contracts/src/<entity>.ts`:

```typescript
import { z } from "zod";

export const widgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  // Timestamps: always use z.union([z.string(), z.date()]).
  // Kysely returns Date objects; JSON serialisation produces ISO-8601 strings.
  // Both must be accepted by the schema.
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]),
});

export const listWidgetsOutputSchema = z.array(widgetSchema);

export type Widget = z.infer<typeof widgetSchema>;
```

### 2 — Re-export from the contracts entry point

In `packages/contracts/src/index.ts`, add:

```typescript
export { widgetSchema, listWidgetsOutputSchema } from "./widgets.js";
export type { Widget } from "./widgets.js";
```

Then add the procedure to the `contract` router definition in the same file:

```typescript
export const contract = oc.router({
  // ... existing procedures
  listWidgets: oc
    .input(z.object({}))   // no input params for a plain list
    .output(listWidgetsOutputSchema),
});
```

### 3 — Add the Kysely table type to `apps/backend/src/db/types.ts`

```typescript
export interface WidgetTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// Add to the Database interface:
export interface Database {
  employees: EmployeeTable;
  widgets: WidgetTable;   // ← new
}

// Utility types:
export type Widget = Selectable<WidgetTable>;
export type NewWidget = Insertable<WidgetTable>;
export type WidgetUpdate = Updateable<WidgetTable>;
```

> `types.ts` is maintained manually — update it whenever a migration adds or alters columns.

### 4 — Implement the procedure handler

Create `apps/backend/src/procedures/list-widgets.ts`:

```typescript
import { implement } from "@orpc/server";
import { contract, listWidgetsOutputSchema } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";

type ListWidgetsOutput = z.infer<typeof listWidgetsOutputSchema>;

/**
 * Plain async function — extracted from the oRPC handler so it can be unit
 * tested via dependency injection without touching oRPC internals.
 */
export async function fetchWidgets(
  db: Kysely<Database> = getDb()
): Promise<ListWidgetsOutput> {
  const rows = await db.selectFrom("widgets").selectAll().execute();
  // Defence-in-depth: validates rows against the contract schema before returning.
  return listWidgetsOutputSchema.parse(rows);
}

/** Production oRPC handler — uses the shared lazy DB singleton. */
export const listWidgetsHandler = implement(contract.listWidgets).handler(
  async () => fetchWidgets()
);

/**
 * Factory for dependency injection in unit tests.
 * Usage: const handler = createListWidgetsHandler(mockDb);
 */
export function createListWidgetsHandler(db: Kysely<Database>) {
  return implement(contract.listWidgets).handler(async () => fetchWidgets(db));
}
```

**Key structural decisions captured here:**
- `fetchWidgets()` is a plain async function, not logic inlined in the handler. This
  allows tests to call it directly with a mock `db` without reaching into `~orpc` internals.
- The `db` parameter defaults to `getDb()` so the production handler needs no wiring.
- `listWidgetsOutputSchema.parse(rows)` inside `fetchWidgets` adds runtime defence-in-depth
  beyond oRPC's contract-level validation.

### 5 — Register the handler on the router

In `apps/backend/src/router.ts`, add the import and register:

```typescript
import { listWidgetsHandler } from "./procedures/list-widgets.js";

export const router = implement(contract).router({
  // ... existing handlers
  listWidgets: listWidgetsHandler,
});
```

### 6 — Write the co-located unit test

Create `apps/backend/src/procedures/list-widgets.test.ts` (same directory as the handler):

```typescript
import { describe, it, expect, vi } from "vitest";
import { call } from "@orpc/server";   // ← public oRPC helper; do NOT use ~orpc internals
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { createListWidgetsHandler } from "./list-widgets.js";

function buildDbMock(rows: unknown[]) {
  const execute  = vi.fn().mockResolvedValue(rows);
  const selectAll = vi.fn().mockReturnValue({ execute });
  const selectFrom = vi.fn().mockReturnValue({ selectAll });
  return {
    db: { selectFrom } as unknown as Kysely<Database>,
    selectFrom,
    selectAll,
    execute,
  };
}

describe("listWidgets procedure", () => {
  it("calls selectFrom('widgets').selectAll().execute() and returns rows", async () => {
    const mockRows = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Sprocket",
        created_at: new Date("2025-01-01T00:00:00.000Z"),
        updated_at: new Date("2025-01-01T00:00:00.000Z"),
      },
    ];
    const { db, selectFrom, selectAll, execute } = buildDbMock(mockRows);
    const handler = createListWidgetsHandler(db);

    // call() is the correct public API for invoking an oRPC handler in tests.
    // Input must match the contract — {} for a no-input list procedure.
    const result = await call(handler, {});

    expect(selectFrom).toHaveBeenCalledWith("widgets");
    expect(selectAll).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockRows);
  });

  it("returns an empty array when the table is empty", async () => {
    const { db, execute } = buildDbMock([]);
    const handler = createListWidgetsHandler(db);

    const result = await call(handler, {});

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});
```

### 7 — Build contracts before type-checking or testing

The backend's TypeScript compilation and Vitest run both consume `packages/contracts/dist/`.
**Always build contracts first:**

```bash
npm run build --workspace=packages/contracts
npx tsc --noEmit -p packages/contracts/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx vitest run   # from apps/backend/
```

The CI pipeline (`.github/workflows/ci.yml`) runs these steps in order; local runs should
mirror this sequence.

---

## Gotchas

### `client.ts` exports `getDb()`, not `db`
`apps/backend/src/db/client.ts` exports a lazy getter function `getDb()`, **not** a
named `db` constant. Importing `{ db }` from `./client.js` will cause a TypeScript
error (`TS2305: Module has no exported member 'db'`).

Any file that needs the Kysely instance must call `const db = getDb();` at the call
site (or at module level after the function import). This applies to `migrate.ts` and
any future CLI utilities — not just procedure handlers.

### Timestamps must use `z.union([z.string(), z.date()])`
Kysely returns `Date` objects from PostgreSQL `timestamptz` columns. When these are
serialised to JSON over HTTP they become ISO-8601 strings. Using `z.string()` alone
will cause the schema to reject `Date` objects returned by the mock/real DB;
using `z.date()` alone will reject JSON-serialised strings on the frontend.
**Always** use `z.union([z.string(), z.date()])` for timestamp fields in the output schema.

### Use `call()` from `@orpc/server` in tests, not `~orpc` internals
oRPC exposes internal metadata on procedure objects via `~orpc` properties. These are
implementation details and are not part of the public API. Use the exported `call(handler, input)`
helper from `@orpc/server` to invoke a procedure in tests. This is the stable, supported
interface.

### Contracts `dist/` must be rebuilt before `tsc` or Vitest
The backend imports from `@cv-tool/contracts` via the compiled `dist/` output, not the
TypeScript source. If `dist/` is stale (e.g. you changed `employees.ts` but did not
rebuild), `tsc --noEmit` and Vitest will silently use the old schema. Run
`npm run build --workspace=packages/contracts` before any type or test check.

### No `__tests__/` directories
Per `docs/arch/testing.md`, test files must be co-located with their source files and
named `<source-file>.test.ts`. Do not create a separate `__tests__/` directory.

### `types.ts` is maintained manually
`apps/backend/src/db/types.ts` is the TypeScript source of truth for table shapes. It is
**not** auto-generated. Update it by hand whenever a migration adds, removes, or alters
a column. Forgetting to do so causes silent type mismatches at runtime.

### `migrate.ts` needs special handling
Because `client.ts` exports `getDb()` (a function), `migrate.ts` cannot use a top-level
`import { db }`. It must call `const db = getDb();` after the import. Since `migrate.ts`
is a CLI script that runs migrations before any web server is started, this is fine — the
`DATABASE_URL` check fires at script start, not at import time.

---

## Acceptance Checklist

- [ ] `packages/contracts/src/<entity>.ts` exports `<entity>Schema` and `list<Entity>OutputSchema`
- [ ] Both schemas are re-exported from `packages/contracts/src/index.ts`
- [ ] `list<Entity>` procedure is added to the `contract` router in `index.ts` with correct output schema
- [ ] `<EntityTable>` interface added to `apps/backend/src/db/types.ts`; `Database` interface updated
- [ ] `fetchEntity()` plain async function with default `db = getDb()` parameter
- [ ] `list<Entity>Handler` and `createList<Entity>Handler(db)` factory exported from procedure file
- [ ] `list<Entity>Handler` registered on router in `apps/backend/src/router.ts`
- [ ] Co-located test file `<procedure>.test.ts` exists; no `__tests__/` dir used
- [ ] Test mocks Kysely fluent chain with `vi.fn()` and uses `call()` from `@orpc/server`
- [ ] Test asserts `selectFrom('<table>')`, `selectAll()`, `execute()` were called
- [ ] Test asserts resolved value equals mock rows (including empty-array edge case)
- [ ] `npx tsc --noEmit -p packages/contracts/tsconfig.json` exits 0
- [ ] `npx tsc --noEmit -p apps/backend/tsconfig.json` exits 0
- [ ] `npx vitest run` (in `apps/backend/`) exits 0
- [ ] No create/update/delete procedures introduced by the same task
- [ ] No imports from `apps/frontend/` in any backend source file

---

## Reference Tasks

- #63 — [TASK] Define employee Zod schemas in @cv-tool/contracts and implement listEmployees oRPC procedure
