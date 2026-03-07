# Testing Architecture

> See ADR-011 for the full decision rationale.

---

## Test Runner

**Vitest** is the sole test runner for all workspaces in the monorepo. No other test runners (Jest, Mocha, Node.js native test runner) are permitted.

### Why Vitest

- Native integration with the existing **Vite** toolchain (used by `@cv-tool/frontend`)
- First-class **TypeScript** support via esbuild — no additional transforms or configuration
- **Jest-compatible API** (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`, `vi.spyOn`) — familiar to most developers
- Built-in **coverage** reporting via the `v8` provider
- Excellent **performance** in Vite/Turborepo monorepo environments (shared config, workspace-aware)

### Installation

`vitest` must be added as a `devDependency` to every workspace that contains tests. It is **not** hoisted to the root — each workspace owns its test configuration.

---

## File Conventions

### Location: Co-located Tests

Test files live **next to the source files they test** — not in a separate `__tests__/` directory.

```
src/
├── services/
│   ├── cv-service.ts
│   ├── cv-service.test.ts          ← unit test
│   └── cv-service.integration.test.ts  ← integration test (if needed)
├── components/
│   ├── CvCard.tsx
│   └── CvCard.test.tsx
└── test-utils/
    ├── render.tsx                  ← custom render with providers (frontend)
    └── db-mock.ts                  ← shared database mock helpers (backend)
```

### Naming

| File type | Pattern | Example |
|-----------|---------|---------|
| Unit test | `<source-file>.test.ts(x)` | `cv-service.test.ts`, `CvCard.test.tsx` |
| Integration test | `<source-file>.integration.test.ts` | `cv-service.integration.test.ts` |
| Test utility | Descriptive `kebab-case` name | `render.tsx`, `db-mock.ts` |

### Rules

- **No `__tests__/` directories.** Tests are always co-located.
- Test file names must match the source file they test (e.g. `user-router.ts` → `user-router.test.ts`).
- Files with the `.integration.test.ts` suffix may require external dependencies (database, network) and can be excluded from fast unit test runs via Vitest's `--exclude` flag.

---

## Test Utilities

Each workspace that has tests may contain a `src/test-utils/` directory for shared helpers.

### Frontend (`@cv-tool/frontend`)

A custom render function wrapping all required providers must live at `src/test-utils/render.tsx`:

```typescript
// Wraps component under test with:
// - QueryClientProvider (TanStack Query)
// - RouterProvider (TanStack Router, using a test router)
// - ThemeProvider + CssBaseline (Material UI)
// - I18nextProvider (react-i18next, using the real en/common.json)
```

**Approved frontend test dependencies** (devDependencies of `@cv-tool/frontend`):
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`

No other testing libraries (e.g. `enzyme`, `react-test-renderer`) are permitted without a dedicated ADR.

### Backend (`@cv-tool/backend`)

Test helpers for database mocking and request simulation live in `src/test-utils/`.

---

## Test Environment

| Workspace | Vitest `environment` | Reason |
|-----------|---------------------|--------|
| `@cv-tool/frontend` | `jsdom` | Component tests require a simulated DOM |
| `@cv-tool/backend` | `node` (default) | Server-side code runs in Node.js |
| `@cv-tool/contracts` | `node` (default) | Schema validation is runtime-agnostic |

The environment is set per-workspace in `vitest.config.ts`.

---

## Coverage

### Thresholds

All workspaces enforce a **minimum 80%** coverage threshold across four metrics:

| Metric | Minimum |
|--------|---------|
| Statements | 80% |
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |

### Provider

Vitest's **`v8`** coverage provider is used (no Istanbul). The `@vitest/coverage-v8` package must be a `devDependency` in each workspace with tests.

### Configuration

Each workspace's `vitest.config.ts` must include:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Exceptions

If a workspace cannot reasonably meet 80% (e.g. a configuration-only package), the threshold may be lowered in that workspace's `vitest.config.ts` with:
1. An explanatory comment in the config file
2. A note in the PR that introduces the exception

### Output

Coverage reports are written to `coverage/` within each workspace. This directory must be **gitignored**.

---

## Mocking

### Built-in Only

All mocking uses Vitest's built-in utilities: `vi.mock()`, `vi.fn()`, `vi.spyOn()`. No additional mocking libraries (`sinon`, `jest-mock-extended`, etc.) are permitted without a dedicated ADR.

### Database Client Mocking

The database client choice is deferred (see ADR-006). To keep tests decoupled from the eventual client, **dependency injection** is the required mocking pattern:

```typescript
// ✅ Correct — function accepts db client as a parameter
export function getUser(db: DatabaseClient, userId: string) { ... }

// In tests:
const mockDb = { query: vi.fn() };
const result = await getUser(mockDb, '123');

// ❌ Wrong — function imports a global singleton
import { db } from '../db';
export function getUser(userId: string) { ... }
```

Service functions that access the database **must** accept the client as a parameter. This enables straightforward mocking without `vi.mock()` on module imports.

### External API Mocking

No network-intercepting libraries (`msw`, `nock`) are approved at this time. External API calls should be mocked at the function boundary using `vi.mock()` on the module that wraps the external call. If a future feature requires HTTP-level interception, a dedicated ADR is required.

---

## Turborepo Pipeline

The `test` task is registered in `turbo.json`:

```jsonc
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

### Explanation

- **`dependsOn: ["^build"]`** — Tests may import from built shared packages (e.g. `@cv-tool/contracts`), so dependent packages must be built first.
- **`outputs: ["coverage/**"]`** — Coverage reports are cached by Turborepo. If source files have not changed, test results are replayed from cache.

### npm Scripts

Each workspace with tests defines in its `package.json`:

```json
{
  "scripts": {
    "test": "vitest run --coverage"
  }
}
```

The root `package.json` defines:

```json
{
  "scripts": {
    "test": "turbo run test"
  }
}
```

### Running Tests

| Command | Scope | Description |
|---------|-------|-------------|
| `npm test` (root) | All workspaces | Runs tests across the entire monorepo via Turborepo |
| `turbo run test --filter=@cv-tool/frontend` | Single workspace | Runs tests for frontend only |
| `npx vitest` (inside workspace) | Single workspace | Runs Vitest in watch mode for development |
| `npx vitest run` (inside workspace) | Single workspace | Single run without watch mode |

---

## Deferred Decisions

The following testing concerns are **explicitly deferred** to future architectural decisions:

| Topic | Reason |
|-------|--------|
| **End-to-end (E2E) tests** | No E2E framework selected (Playwright, Cypress). Deferred until the application has sufficient UI to warrant E2E tests. |
| **Integration tests with live database** | Requires database client selection (deferred per ADR-006). Convention for spinning up test databases will be defined then. |
| **Network mocking (MSW/nock)** | No approved library. Deferred until a feature requires HTTP-level test interception. |
| **CI test pipeline** | CI/CD is not yet configured (see `docs/arch/infrastructure.md`). Test execution in CI will be defined when CI is set up. |
