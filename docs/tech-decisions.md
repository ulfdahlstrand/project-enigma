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
- The `apps/` vs `packages/` distinction is meaningful and must be respected: apps are deployed/run; packages are libraries consumed by apps.

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
