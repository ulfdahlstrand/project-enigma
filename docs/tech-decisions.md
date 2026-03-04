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
