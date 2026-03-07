# Architecture

> Maintained by the Architect Agent. All changes require a dedicated architectural task.

## Overview

The **CV Creation Tool** is a web-based application that allows consultants at a consultancy company to efficiently manage, tailor, and export their CVs for specific client assignments. The system is structured as a Turborepo monorepo containing a React single-page application (frontend), a Node.js API server (backend), and a PostgreSQL database — all orchestrated locally via Docker Compose.

### Major Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **Frontend** | `apps/frontend/` | React SPA — routing, data fetching, UI rendering, internationalisation |
| **Backend** | `apps/backend/` | Node.js oRPC server — business logic, input validation, database access |
| **Database** | Docker (PostgreSQL) | Persistent data storage; managed via migration scripts |
| **Contracts** | `packages/contracts/` | Shared oRPC router types and Zod schemas consumed by both frontend and backend |
| **TS Config** | `packages/tsconfig/` | Shared TypeScript configuration extended by all workspaces |

---

## Sub-Documents

Domain-specific details live in dedicated sub-documents under `docs/arch/`. **Do not put domain-specific details in this index file.**

| File | Domain |
|------|--------|
| [`arch/frontend.md`](./arch/frontend.md) | UI, components, styling, routing, data-fetching, i18n |
| [`arch/backend.md`](./arch/backend.md) | Server, API (oRPC), services, shared contracts, database client (Kysely) |
| [`arch/data-model.md`](./arch/data-model.md) | Database, schema, migrations (Kysely Migrator) |
| [`arch/testing.md`](./arch/testing.md) | Test framework, file conventions, coverage |
| [`arch/infrastructure.md`](./arch/infrastructure.md) | Docker, Turborepo pipeline, CI/CD, environments, deployment |

---

## Tech Stack (Summary)

| Layer | Technology |
|-------|-----------|
| Language | **TypeScript** (strict mode, all workspaces) |
| Monorepo | **Turborepo** + **npm workspaces** |
| Frontend | **React**, **Vite**, **Material UI**, **TanStack Router**, **TanStack Query**, **react-i18next** |
| Backend | **Node.js**, **oRPC**, **Kysely** |
| Validation | **Zod** (shared via `@cv-tool/contracts`) |
| Database | **PostgreSQL** |
| Local orchestration | **Docker Compose** |

For full details per layer, see the relevant sub-document above.

---

## Monorepo Structure

```
/
├── apps/
│   ├── frontend/          # @cv-tool/frontend — React SPA (Vite)
│   └── backend/           # @cv-tool/backend  — Node.js oRPC server
├── packages/
│   ├── tsconfig/          # @cv-tool/tsconfig  — Shared TypeScript base configs
│   └── contracts/         # @cv-tool/contracts — Shared oRPC router types & Zod schemas
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── docs/
│   ├── architecture.md    # This file (index)
│   ├── tech-decisions.md  # ADR log
│   ├── arch/              # Domain sub-documents
│   └── agents/            # Agent system prompts
├── turbo.json
├── package.json           # Root workspace config (npm workspaces)
└── tsconfig.json          # Root TS config — extends packages/tsconfig base
```

### Directory Responsibilities (Summary)

- **`apps/`** — Application code. Apps are deployed/run. See [`frontend.md`](./arch/frontend.md), [`backend.md`](./arch/backend.md).
- **`packages/`** — Shared libraries consumed by apps. No business logic.
- **`docker/`** — All Docker-related files. See [`infrastructure.md`](./arch/infrastructure.md).
- **`docs/`** — Architecture documentation and ADRs. Not consumed by application code.

---

## Cross-Cutting Conventions

These conventions apply to all workspaces and are not owned by a single sub-document.

### Naming Conventions

#### Workspace Package Names

The `@cv-tool/` npm scope is used as the `name` field in every workspace `package.json`:

| Workspace path | Package name |
|---------------|--------------|
| `apps/frontend/` | `@cv-tool/frontend` |
| `apps/backend/` | `@cv-tool/backend` |
| `packages/tsconfig/` | `@cv-tool/tsconfig` |
| `packages/contracts/` | `@cv-tool/contracts` |

> No workspace `name` may match a name on the public npm registry. The `@cv-tool/` scope is private and unregistered.

#### File and Folder Naming

- **Folders:** `kebab-case` (e.g. `src/route-handlers/`)
- **TypeScript files:** `kebab-case` for modules/utilities (e.g. `user-router.ts`); `PascalCase` for React component files (e.g. `UserCard.tsx`)
- **React components:** `PascalCase` named exports (e.g. `export function UserCard()`)
- **oRPC procedures:** `camelCase` (e.g. `getUser`, `listResumes`)
- **Zod schemas:** `camelCase` with `Schema` suffix (e.g. `getUserInputSchema`)
- **Environment variables:** `SCREAMING_SNAKE_CASE` with service prefix (e.g. `BACKEND_PORT`). Frontend: `VITE_` prefix.

### TypeScript — Strict Mode Required

All workspaces are TypeScript. Plain JavaScript files (`.js`, `.cjs`, `.mjs`) are **not permitted** in any workspace source directory. Every workspace `tsconfig.json` extends from `@cv-tool/tsconfig` and must **not** override strict settings.

Required `compilerOptions` in the shared base:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### No Cross-App Direct Imports

`apps/frontend/` must **never** import directly from `apps/backend/` (or vice versa). All shared code lives in `packages/`. Cross-app sharing is done only through shared packages.

### Shared Configuration via `packages/`

Configuration used by more than one workspace belongs in a `packages/` workspace, not duplicated per-app. Applies to TypeScript configs (`@cv-tool/tsconfig`) and oRPC/Zod schemas (`@cv-tool/contracts`).

### Generated Files Are Gitignored

Files generated by build tools or codegen plugins (e.g. TanStack Router's `routeTree.gen.ts`) must be gitignored. They are produced during `dev` and `build` steps and must not be committed.

---

## Decision Log

See [tech-decisions.md](./tech-decisions.md)
