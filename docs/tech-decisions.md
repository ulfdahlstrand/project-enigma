# Technical Decisions (ADR Log)

> Append-only. Never delete or modify past decisions.

## Template
### [DATE] - [DECISION TITLE]
**Status:** Proposed | Accepted | Superseded  
**Context:** Why was this decision needed?  
**Decision:** What was decided?  
**Consequences:** What does this mean going forward?

---

## ADR-001 — 2026-03-04 — Turborepo as Monorepo Orchestration Tool

**Status:** Accepted

**Context:**
The CV Creation Tool is composed of multiple independent workspaces (frontend, backend, shared packages). These workspaces have interdependencies — e.g. `@cv-tool/frontend` and `@cv-tool/backend` both depend on `@cv-tool/contracts`. Without a monorepo orchestrator, teams would need to manually coordinate build order, manage cross-workspace symlinks, and run tasks repeatedly even when nothing has changed. Several monorepo tools exist: Turborepo, Nx, Lerna (deprecated), and Bazel (overly complex for this scale).

**Decision:**
Use **Turborepo** (by Vercel) as the monorepo task orchestration and caching layer. npm workspaces handle the package linking; Turborepo handles task scheduling, dependency-aware ordering (`"dependsOn": ["^build"]`), and incremental build caching.

**Consequences:**
- A `turbo.json` at the repo root defines all pipelines (`build`, `dev`, `lint`, `typecheck`).
- The `build` task must declare `"dependsOn": ["^build"]` so shared packages are built before the apps that consume them.
- Turborepo's local caching means unchanged packages are not rebuilt, significantly reducing `build` and `typecheck` times.
- Remote caching (Vercel or self-hosted) is possible in future but is out of scope for the initial setup.
- All tasks must be run via `turbo run <task>` from the repo root (or via the `scripts` in the root `package.json`).

---

## ADR-002 — 2026-03-04 — `@cv-tool/` Scoped Package Naming for All Workspaces

**Status:** Accepted

**Context:**
In a monorepo, workspace packages reference each other by the `name` field in their `package.json`. Without a consistent, namespaced naming convention, two problems arise: (1) names can accidentally collide with public npm packages, causing installation ambiguity; (2) the relationship between a workspace folder path and its importable name is unclear to new contributors. A scoped package name (e.g. `@org/package`) clearly communicates ownership and is conventionally used for private/internal packages.

**Decision:**
Every workspace in the monorepo — whether under `apps/` or `packages/` — must use the **`@cv-tool/` npm scope** as the prefix of its `name` field in `package.json`. The short name after the scope must match the folder name:

| Workspace path       | Package name            |
|----------------------|-------------------------|
| `apps/frontend/`     | `@cv-tool/frontend`     |
| `apps/backend/`      | `@cv-tool/backend`      |
| `packages/tsconfig/` | `@cv-tool/tsconfig`     |
| `packages/contracts/`| `@cv-tool/contracts`    |

The `@cv-tool/` scope is **not** registered on the public npm registry. All packages are `"private": true`.

**Consequences:**
- Cross-workspace imports use the scoped name: `import type { AppRouter } from "@cv-tool/contracts"`.
- No workspace name can collide with a public npm package because the scope is private and unregistered.
- Future packages must follow the same `@cv-tool/<folder-name>` pattern.
- The scope applies to both `apps/*` and `packages/*` — there is no distinction in naming by workspace type.

---

## ADR-003 — 2026-03-04 — TypeScript-Only Policy with Strict Mode

**Status:** Accepted

**Context:**
Mixed-language codebases (TypeScript + JavaScript) introduce friction: developers must track which files are type-checked, IDEs show inconsistent errors, and shared type contracts can be silently broken by untyped JS files. The Epic (#2) explicitly mandates TypeScript for all workspaces and TypeScript strict mode (constraint #6). To enforce this consistently, a shared base `tsconfig` is required so that no workspace can accidentally opt out of strictness by omitting a compiler option.

**Decision:**
1. **All workspaces are TypeScript.** No `.js`, `.cjs`, or `.mjs` source files are permitted in any workspace `src/` directory. Configuration files at the root level (e.g. `turbo.json`, `docker-compose.yml`) are not TypeScript and are exempt.
2. **Strict mode is mandatory.** The shared `@cv-tool/tsconfig` base config sets:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true
     }
   }
   ```
3. **All workspace `tsconfig.json` files extend from `@cv-tool/tsconfig`** and must not override `strict`, `noUncheckedIndexedAccess`, or `exactOptionalPropertyTypes` to weaker settings.
4. **The `@cv-tool/tsconfig` package exports multiple named base configs** to accommodate different runtime targets (e.g. `base.json` for any workspace, `react.json` for frontend, `node.json` for backend), all of which enforce the strict settings above.

**Consequences:**
- Type errors surface at compile time rather than at runtime, including index-access and optional-property edge cases.
- All oRPC procedure types, Zod schemas, and shared contracts are fully typed end-to-end.
- New workspaces must extend from `@cv-tool/tsconfig` — they may not use a standalone `tsconfig.json` that does not inherit from the shared base.
- There is no escape hatch: `@ts-ignore` and `@ts-expect-error` must be used sparingly and must include an explanatory comment.

---

## ADR-004 — 2026-03-04 — Canonical Folder Structure for the Monorepo

**Status:** Accepted

**Context:**
Without a defined folder structure, each developer makes local decisions about where to place code: some put shared types in `apps/backend/src/types/`, others in `apps/frontend/src/shared/`, creating duplication and fragile imports. A canonical layout, recorded as an ADR, ensures all contributors (human and AI agents) place files in predictable locations from the start.

**Decision:**
The canonical monorepo layout is:

```
/
├── apps/
│   ├── frontend/          # @cv-tool/frontend — React SPA
│   └── backend/           # @cv-tool/backend  — Node.js oRPC server
├── packages/
│   ├── tsconfig/          # @cv-tool/tsconfig  — Shared TypeScript base configs (no runtime code)
│   └── contracts/         # @cv-tool/contracts — Shared oRPC router types & Zod schemas
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── docs/
│   ├── architecture.md
│   ├── tech-decisions.md
│   └── agents/
├── turbo.json
├── package.json           # Root workspace definition (npm workspaces)
└── tsconfig.json          # Root TS config — extends @cv-tool/tsconfig base
```

**Rules enforced by this structure:**
1. Application code lives only in `apps/`. No business logic in `packages/`.
2. Shared code (types, schemas, config) lives only in `packages/`. No shared code duplicated across apps.
3. `packages/contracts/` is the single source of truth for all oRPC router types and Zod schemas.
4. `docker/` contains all Docker-related files. No `Dockerfile` or `docker-compose.yml` at the repo root.
5. `docs/` contains only documentation. It is never imported by application code.

**Consequences:**
- Feature #8 (frontend) and Feature #5 (backend) implementers know exactly where to find shared types: `@cv-tool/contracts`.
- The structure is extensible: additional packages (e.g. `packages/ui/`, `packages/db/`) follow the same pattern without ambiguity.
- Any deviation from this structure requires a new ADR and an update to `architecture.md`.
- The `apps/` vs `packages/` distinction is meaningful and must be respected: apps are deployed/run; packages are library consumed by apps.

---

## ADR-005 — 2026-03-04 — oRPC as the RPC Framework

**Status:** Accepted

**Context:**
The CV Creation Tool requires a typed communication layer between the React frontend and the Node.js backend. The key requirements are: (1) end-to-end type safety without manual type duplication, (2) input/output validation at the boundary, (3) the ability to generate an OpenAPI specification for potential future consumers, and (4) compatibility with Zod for schema definitions. Several options exist: REST with manual types, GraphQL (heavy for this use case), tRPC (popular but no native OpenAPI), and oRPC (end-to-end typed with native OpenAPI support).

**Decision:**
Use **oRPC** ([orpc.dev](https://orpc.dev/docs/openapi/getting-started)) as the sole API communication layer between the frontend and backend. oRPC is **not** tRPC — it is a distinct library with different APIs and built-in OpenAPI specification generation.

Key aspects of the decision:
1. **oRPC is the only API layer.** No REST endpoints, no GraphQL — all frontend-to-backend communication goes through oRPC procedures.
2. **Zod schemas define all procedure inputs and outputs.** These schemas live in `@cv-tool/contracts` and are shared by both apps.
3. **The backend implements the oRPC router.** Procedure handlers are registered in `apps/backend/`.
4. **The frontend imports the router type from `@cv-tool/contracts`** to create a fully type-safe oRPC client — no code generation step required.
5. **Transport is HTTP (JSON).** The backend exposes a single HTTP endpoint that the oRPC handler processes.

**Consequences:**
- Adding a new procedure requires: (1) defining the Zod input/output schemas in `@cv-tool/contracts`, (2) implementing the handler in `apps/backend/`, (3) calling the procedure from `apps/frontend/` — type errors surface immediately if any step is inconsistent.
- An OpenAPI specification is automatically generated, which can be used for documentation or future non-TypeScript clients.
- The team must use oRPC's API surface, not tRPC's. Documentation at [orpc.dev](https://orpc.dev) is the reference.
- `@cv-tool/contracts` becomes a critical dependency: both apps must rebuild when contract schemas change (enforced by Turborepo's `"dependsOn": ["^build"]`).

---

## ADR-006 — 2026-03-04 — PostgreSQL as the Primary Database

**Status:** Accepted

**Context:**
The CV Creation Tool needs a persistent data store for consultant profiles, CV data, and related metadata. The data is inherently relational (consultants have many CVs, CVs have many sections, etc.), and the application requires transactional consistency for updates. Options considered: PostgreSQL (mature relational DB, strong ecosystem), SQLite (too limited for concurrent access in a containerised setup), MySQL/MariaDB (viable but less featureful than PostgreSQL for JSON and advanced types), and NoSQL options like MongoDB (unnecessary complexity for a relational domain).

**Decision:**
Use **PostgreSQL** (version 16 or later) as the sole persistent data store for the application.

Key aspects:
1. **Local development:** PostgreSQL runs as a Docker container managed by Docker Compose (`postgres:16` image or later).
2. **Connection:** The backend connects via a `DATABASE_URL` environment variable containing a standard PostgreSQL connection string.
3. **Access pattern:** Only `apps/backend/` connects to the database. The frontend **never** accesses PostgreSQL directly — all data access is mediated through oRPC procedures.
4. **Migrations:** Database schema changes are managed via migration scripts. Scripts use a timestamp-prefixed naming convention (`YYYYMMDDHHMMSS_description.sql`) to guarantee deterministic ordering. The specific migration tool/runner is to be decided in the database feature task (#3) and recorded as a separate ADR.
5. **No ORM mandate:** The choice of database client (raw SQL, query builder like Kysely, or a lightweight ORM) is deferred to the backend/database feature tasks. The architectural constraint is that the client must support TypeScript and parameterised queries (no string concatenation for SQL).

**Consequences:**
- PostgreSQL must be running (via Docker Compose) for the backend to function locally.
- The `DATABASE_URL` environment variable must be configured in Docker Compose and in `.env.example` files.
- Schema changes require a new migration file — no manual `ALTER TABLE` against the running database.
- The migration tool decision is a downstream dependency; until it is made, migration scripts can be plain `.sql` files run in order.
- Future production deployment will need a managed PostgreSQL instance (out of scope for Epic #2).

---

## ADR-007 — 2026-03-04 — TanStack Router and TanStack Query as the Frontend Data Layer

**Status:** Accepted

**Context:**
The frontend needs two capabilities: (1) client-side routing with type-safe route parameters and code splitting, and (2) server-state management for fetching, caching, and synchronising data from the backend. For routing, options include React Router (widely used but limited type safety), TanStack Router (file-based routing with full TypeScript codegen), and Next.js (full framework — too opinionated for this SPA). For data fetching, options include raw `fetch`/`useEffect` (error-prone), SWR (lightweight), and TanStack Query (feature-rich, widely adopted, excellent TypeScript support).

**Decision:**
Use **TanStack Router** for client-side routing and **TanStack Query** for server-state management in `apps/frontend/`.

Key aspects:
1. **TanStack Router** is configured with **file-based routing and route codegen**. Route files in a designated directory are automatically discovered and a typed route tree is generated. This provides compile-time validation of route paths, search params, and route context.
2. **TanStack Query** manages all server-state: data fetching, caching, background re-fetching, and mutation lifecycle. The oRPC client is invoked within TanStack Query's `queryFn` / `mutationFn`.
3. **No direct `fetch` calls.** All backend communication in the frontend goes through TanStack Query hooks that use the oRPC client internally. This ensures consistent caching, loading states, and error handling.
4. **Integration pattern:** Route loaders (TanStack Router) may pre-fetch data via TanStack Query's `prefetchQuery` to enable data loading before component render.

**Consequences:**
- Route definitions are generated files — developers add a route file in the designated folder and the codegen produces the typed route tree. Generated files should be committed or regenerated on build (to be decided by the frontend feature task).
- TanStack Query's `QueryClient` must be configured at the application root and provided via context.
- All data-fetching logic is co-located with query key definitions, making cache invalidation explicit and traceable.
- The combination of oRPC types + TanStack Query provides end-to-end type safety from database schema → Zod schema → oRPC procedure → query hook → component props.
- Both libraries are actively maintained and have strong TypeScript support, reducing the risk of type regression.

---

## ADR-008 — 2026-03-05 — Material UI as the Frontend Component Library

**Status:** Accepted

**Context:**
The CV Creation Tool frontend needs a component library to provide consistent, pre-built UI primitives for layout, navigation, and typography. Without a shared component library, each feature would need to build and style UI elements from scratch, leading to visual inconsistency, duplicated effort, and ad-hoc CSS. The application requires components for layout shells (AppBar, Drawer), form controls (for future CV editing), and typography — all with built-in accessibility and theming support. Options considered: Material UI (mature, comprehensive, excellent TypeScript support, built-in theming), Chakra UI (similar approach but smaller ecosystem), Radix + custom styles (too much custom work for this project's scope), and no library (unacceptable maintenance burden).

**Decision:**
Use **Material UI** (latest version, `@mui/material`) as the sole frontend component and UI library for `@cv-tool/frontend`. MUI is paired with **Emotion** (`@emotion/react`, `@emotion/styled`) as its styling engine.

Key aspects of the decision:
1. **MUI is the sole component/UI library.** No other component libraries (e.g. Chakra, Ant Design) may be introduced alongside MUI. Custom HTML elements should only be used when MUI does not provide an appropriate component.
2. **`ThemeProvider` and `CssBaseline` are mandatory wrappers.** They must be rendered at the application root (in `App.tsx` or `__root.tsx`), wrapping or sitting alongside the existing provider chain (`QueryClientProvider` → `RouterProvider`). `CssBaseline` normalises browser styles globally.
3. **The `sx` prop is the primary styling mechanism.** All component styling should use MUI's `sx` prop or the theme object. Raw CSS files (`.css`, `.scss`, etc.) and inline `style` objects are **not permitted** where MUI's `sx` prop or theme covers the need. This ensures styling remains within MUI's theme-aware system.
4. **MUI components are the standard primitives.** Layout uses `Box`, `Stack`, `Container`; navigation uses `AppBar`, `Toolbar`, `Drawer`, `List`; text uses `Typography`. Developers should reach for MUI components before creating custom equivalents.
5. **Theme configuration lives in `apps/frontend/src/lib/theme.ts`**, following the existing pattern for library/config files (`i18n.ts`, `orpc-client.ts`). The theme uses `createTheme()` with MUI defaults — custom branding, colours, and typography are out of scope for the initial setup.

**Consequences:**
- All frontend UI work builds on MUI components, ensuring visual and behavioural consistency across the application.
- The `@mui/material`, `@emotion/react`, and `@emotion/styled` packages must be listed as dependencies of `@cv-tool/frontend`.
- No `.css` or `.scss` files should be added to the frontend source directory for component styling. The `sx` prop and theme handle all styling needs.
- Future UI features (forms, dialogs, data tables) should use MUI components rather than introducing additional libraries.
- MUI's TypeScript typings provide compile-time safety for component props, including `sx` prop values.
- The Emotion dependency is an implementation detail of MUI and should not be used directly for styling outside of MUI's API (i.e. no standalone `styled()` calls unless wrapping MUI components).

---

## ADR-009 — 2026-03-06 — `country-flag-icons` as the Flag Icon Library

**Status:** Accepted

**Context:**
Epic #40 (Internationalisation — Language Selector) requires displaying country flag icons alongside language options in the language selector UI. The current architecture does not include any approved flag or icon asset library. ADR-008 established Material UI as the sole **component** library, but a flag icon library is a supplementary **asset** library (SVG flag icons) and does not compete with MUI's component role. Two candidates were evaluated:
- **`flagpack-core` + `flagpack-react`** — requires two packages; the React wrapper provides components but has a smaller community and less frequent updates.
- **`country-flag-icons`** — single package; provides framework-agnostic SVG files and dedicated React component exports with built-in TypeScript type definitions; tree-shakeable so only imported flags are included in the bundle; actively maintained with broad flag coverage.

**Decision:**
Use **`country-flag-icons`** as the sole flag icon library for `@cv-tool/frontend`.

Key aspects:
1. **Single dependency.** Only the `country-flag-icons` npm package is needed — no wrapper or companion package required.
2. **React SVG components.** Flags are imported as React components from `country-flag-icons/react/3x2` (landscape 3:2 aspect ratio) or `country-flag-icons/react/1x1` (square). The `3x2` variant is preferred unless design requires square icons.
3. **Tree-shakeable.** Each flag is a separate module. Only the flags that are explicitly imported are included in the production bundle, keeping the bundle size minimal.
4. **TypeScript types included.** The package ships with built-in TypeScript type definitions — no `@types/` package needed.
5. **ISO 3166-1 alpha-2 codes.** Flags are identified by standard two-letter country codes (e.g. `GB`, `SE`, `DE`). The mapping from locale codes (e.g. `en`, `sv`) to country codes is **not** provided by the library and must be implemented by the consuming component (e.g. the language selector).
6. **MUI compatibility.** Flag components render as inline `<svg>` elements and can be placed inside any MUI component (`MenuItem`, `ListItemIcon`, `IconButton`, etc.). Sizing is controlled via `width`/`height` props on the SVG or via MUI's `sx` prop on a wrapping `Box`.
7. **Exclusivity.** No other flag or country-icon library may be introduced without a new ADR. This is an asset library, not a component library — ADR-008 (MUI as sole component library) remains intact.
8. **Frontend only.** `country-flag-icons` must be listed as a dependency of `@cv-tool/frontend` only. It is not needed by `@cv-tool/backend` or any shared package.

**Consequences:**
- Developers can import flags directly: `import GB from 'country-flag-icons/react/3x2/GB'` and render them as React components inside MUI layouts.
- The language selector component must maintain a locale-to-country-code mapping (e.g. `{ en: 'GB', sv: 'SE', de: 'DE' }`).
- Bundle impact is minimal: only the SVGs for the supported languages are included (currently English/Swedish, potentially more as languages are added).
- If the project later needs a different set of icons (e.g. general-purpose icons beyond flags), that would require a separate ADR — this decision covers flag icons only.

---

## ADR-010 — 2026-03-07 — Split Architecture Documentation into Domain Sub-Documents

**Status:** Accepted

**Context:**
The monolithic `docs/architecture.md` file had grown to approximately 400 lines, covering every domain (frontend, backend, database, infrastructure, testing) in a single document. Every agent interaction that needed architectural context had to read the entire file, consuming a large number of tokens even when only one domain was relevant. As the project grows and more decisions are recorded, this problem compounds. The architecture documentation needed to be restructured so that agents and contributors can read only the domain-specific sections they need.

**Decision:**
Split `docs/architecture.md` into a concise **index file** plus **five domain-specific sub-documents** under `docs/arch/`:

| File | Domain | Content moved from `architecture.md` |
|------|--------|--------------------------------------|
| `docs/arch/frontend.md` | UI, components, styling, routing, data-fetching, i18n | Material UI rules, flag icons, TanStack Router/Query patterns, react-i18next, frontend directory structure |
| `docs/arch/backend.md` | Server, API, services, shared contracts | oRPC API layer rules, shared type contracts, database access patterns, backend directory structure |
| `docs/arch/data-model.md` | Database, schema, migrations | PostgreSQL setup, migration conventions, database client constraints |
| `docs/arch/testing.md` | Test framework, file conventions, coverage | Placeholder — decisions pending |
| `docs/arch/infrastructure.md` | Docker, Turborepo pipeline, CI/CD, environments, deployment | Docker Compose setup, Turborepo pipeline config, environment variable conventions |

The restructured `architecture.md` retains:
- High-level system overview and major components table
- Tech stack summary table
- Monorepo structure diagram
- **Cross-cutting conventions** that span multiple domains (naming conventions, TypeScript strict mode, no cross-app imports, shared config pattern, gitignore rules)
- A sub-document index table linking to all `docs/arch/` files

**Consequences:**
- Agents reading architecture context for a specific domain load only the relevant sub-document (~50–100 lines) instead of the full monolithic file (~400 lines), significantly reducing token usage per prompt.
- The index file (`architecture.md`) remains the entry point and contains the sub-document table so agents can identify which file to read.
- New architectural domains that emerge in the future get their own sub-document under `docs/arch/`, registered in the index table.
- All existing ADRs (001–009) remain in `tech-decisions.md` unchanged. Sub-documents reference ADRs by number (e.g. "See ADR-008") rather than duplicating decision rationale.
- Only the Architect Agent may write to files under `docs/arch/` or to `docs/architecture.md`.

---

## ADR-011 — 2026-03-08 — Vitest as Test Runner with Co-located Tests and 80% Coverage Threshold
## ADR-011 — 2026-03-08 — Kysely as Database Client and Migration Runner

**Status:** Accepted

**Context:**
The testing architecture sub-document (`docs/arch/testing.md`) was a placeholder with no decisions recorded. Multiple feature tasks require unit and integration tests, but there was no architectural guidance on: test runner selection, file naming/location conventions, coverage thresholds, mocking patterns, or the Turborepo `test` pipeline. Without these decisions, each developer task would make ad-hoc choices leading to inconsistent test infrastructure across workspaces.

**Decision:**
1. **Test runner: Vitest.** Vitest is the sole test runner for all workspaces. It integrates natively with the existing Vite toolchain (used by the frontend), supports TypeScript via esbuild without additional transforms, and provides a Jest-compatible API (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`). No other test runners (Jest, Mocha, Node.js native test runner) are permitted.

2. **File conventions: Co-located tests.** Test files live next to the source files they test (`cv-service.test.ts` alongside `cv-service.ts`). No `__tests__/` directories. Integration tests use the `.integration.test.ts` suffix. Test utility files (shared helpers, custom render functions) live in `src/test-utils/` within each workspace.

3. **Coverage thresholds: 80% minimum.** All workspaces enforce 80% for statements, branches, functions, and lines using Vitest's `v8` coverage provider. Exceptions require an explanatory comment in `vitest.config.ts` and a note in the introducing PR.

4. **Mocking: Vitest built-in only.** Use `vi.mock`, `vi.fn`, `vi.spyOn` for all mocking. No additional mocking libraries (`sinon`, `jest-mock-extended`, etc.) without a dedicated ADR. Database mocking uses dependency injection — service functions accept the database client as a parameter rather than importing a global singleton.

5. **Frontend test environment: jsdom + Testing Library.** Frontend component tests use `environment: 'jsdom'` with `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` as approved dependencies. A custom render function with all providers (QueryClient, Router, ThemeProvider, i18n) lives in `src/test-utils/render.tsx`.

6. **Turborepo `test` pipeline.** A `test` task is added to `turbo.json` with `"dependsOn": ["^build"]` (tests may import from built packages) and `"outputs": ["coverage/**"]` (for caching). Each workspace defines `"test": "vitest run --coverage"` in its `package.json` scripts. The root `package.json` defines `"test": "turbo run test"`.

**Consequences:**
- All test code across the monorepo uses a single runner and a consistent file layout, making it easy to navigate and maintain.
- `vitest` must be added as a dev dependency to every workspace that has tests. Frontend additionally needs `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event`.
- Coverage reports are generated in `coverage/` directories (gitignored) and cached by Turborepo.
- The dependency injection pattern for database access ensures tests are decoupled from the eventual database client choice (deferred per ADR-006).
- Integration and end-to-end testing strategies are deferred to a future architectural decision; this ADR covers unit and component tests only.
- No network-intercepting libraries (`msw`, `nock`) may be used without a dedicated ADR.
ADR-006 established PostgreSQL as the sole persistent data store and deferred two decisions: (1) the database client library (raw SQL, query builder, or lightweight ORM) and (2) the migration runner. The constraints from ADR-006 are: the client must support TypeScript and use parameterised queries (no string concatenation). Epic #55 requires creating database tables and querying them from the backend, making these decisions blocking prerequisites.

Options evaluated:
- **`pg` (raw SQL)** — Maximum control, but no type safety for queries. Column/table names are plain strings; return types are `any` unless manually typed. Verbose for common CRUD patterns. No built-in migration support.
- **Kysely** — Type-safe SQL query builder (not an ORM). Queries are written using a fluent TypeScript API that compiles to parameterised SQL. Full type inference for column names, table names, and return types. Built-in `Migrator` class supports TypeScript migration files. Uses the `pg` driver under the hood via the PostgreSQL dialect. Lightweight (~40KB), no code generation required for basic use.
- **Drizzle ORM** — TypeScript ORM with SQL-like syntax and its own migration tooling. Heavier abstraction layer with a schema-definition DSL. More opinionated than Kysely; introduces ORM concepts (relations, prepared statements) that add complexity beyond what this project needs.
- **Prisma** — Full ORM with its own schema language (`.prisma` files), code generation step, and migration engine. Heavy dependency, introduces a non-TypeScript schema language, and requires a build step to generate the client — conflicts with the project's TypeScript-only policy (ADR-003) at the schema definition layer.

**Decision:**
Use **Kysely** as both the database client and the migration runner for `@cv-tool/backend`.

Key aspects:
1. **Kysely is the sole database client.** All database queries in the backend must use the Kysely query builder. No other query builders, ORMs, or direct `pg` client usage for application queries.
2. **The `pg` package is the underlying PostgreSQL driver.** Kysely's `PostgresDialect` uses a `pg.Pool` instance. The `pg` package is a dependency of `@cv-tool/backend` but must not be used directly for application queries — only through Kysely.
3. **A single `Kysely<Database>` instance** is created in `apps/backend/src/db/client.ts` and exported for use by all procedure handlers. The `Database` type interface is defined in `apps/backend/src/db/types.ts`.
4. **Kysely's built-in `Migrator`** is the migration runner. It is configured with a `FileMigrationProvider` pointing to `apps/backend/src/db/migrations/`.
5. **Migration files are TypeScript** (`.ts`), not plain SQL. This allows using Kysely's type-safe schema builder for DDL operations while still permitting raw `sql` tagged templates for edge cases.
6. **The timestamp-prefixed naming convention from ADR-006 is preserved:** `YYYYMMDDHHMMSS_description.ts`.
7. **A `migrate` script** in `apps/backend/package.json` runs all pending migrations via `tsx src/db/migrate.ts`.
8. **Backend-only dependency.** `kysely` and `pg` are listed as dependencies of `@cv-tool/backend` only. No other workspace depends on them.

**Consequences:**
- All database queries are type-safe: column names, table names, and return types are checked at compile time via the `Database` type interface.
- Parameterised queries are guaranteed by Kysely's design — no string concatenation is possible through its API.
- The `Database` type interface in `types.ts` must be updated manually when migrations add or alter columns. Optionally, `kysely-codegen` can generate types from the live schema during development, but the committed `types.ts` is the source of truth.
- Migration files use Kysely's schema builder API (e.g. `db.schema.createTable(...)`) rather than raw SQL strings, providing a consistent developer experience.
- The `kysely_migration` table is automatically managed by Kysely's Migrator and must not be modified manually.
- Kysely has no runtime overhead beyond parameterised query construction — it does not add connection pooling (that is handled by `pg.Pool`), caching, or other middleware.
- Future database tooling decisions (e.g. seeding) are separate from this ADR and do not affect the Kysely choice.
