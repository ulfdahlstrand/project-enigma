## Goal
Bootstrap the `apps/backend` Node.js application within the monorepo, configured with TypeScript strict mode, oRPC as the RPC framework, Zod for input validation, a working health-check endpoint, and exported type contracts consumable by the frontend via a shared package.

Part of #5

---

## Background
The backend is the API layer between the frontend and the PostgreSQL database. Before any CV-specific business logic can be built, the backend application shell must exist: runnable locally, type-safe end-to-end via oRPC, and integrated into the Turborepo monorepo so that shared type contracts are automatically available to the frontend. This task delivers that shell — nothing more.

---

## Acceptance Criteria

1. `apps/backend` is listed as a workspace in the `workspaces` field of the root `package.json`.
2. Running `npm run dev` from `apps/backend` starts a local HTTP server. The server listens on a configured port (e.g. `BACKEND_PORT`) and a startup log line or successful HTTP response on the health endpoint confirms it is running.
3. Running `turbo dev` (or `npm run dev`) from the monorepo root also starts the backend server as part of the Turborepo pipeline without errors.
4. The backend is written in TypeScript with `strict: true` enabled in its `tsconfig.json`.
5. The project compiles without TypeScript errors (`tsc --noEmit` exits 0).
6. oRPC is installed and configured as the sole RPC framework (no tRPC or other RPC libraries are present in `apps/backend/package.json`).
7. A `health` oRPC procedure exists that:
   a. Accepts a Zod-validated input (e.g. `{ echo: z.string().optional() }`).
   b. Returns a typed response (e.g. `{ status: "ok", echo?: string }`).
   c. Is reachable via HTTP and returns the expected JSON payload when called with a valid input.
8. Calling the `health` procedure with an invalid input (e.g. a non-string `echo` value) returns a validation error response (HTTP 4xx) without crashing the server.
9. The oRPC router contract and inferred types are exported from `packages/contracts` (`@cv-tool/contracts`) so that any workspace can import them. The `packages/contracts/src/index.ts` (or equivalent entry point) exports at least the router type and the `health` procedure's input/output Zod schemas.
10. `@cv-tool/contracts` is listed as a dependency in `apps/backend/package.json` using its package name (not a `file:` path reference or relative path). Running `npm install` from the repo root resolves the package via npm workspace linking without errors.
11. A `build` script exists in `apps/backend/package.json` that compiles the TypeScript to JavaScript (`tsc` exits 0).
12. The `turbo.json` pipeline includes `build` and `dev` tasks for `apps/backend`.

---

## Out of Scope
- Any CV-specific data models, procedures, or business logic.
- Database connectivity or ORM setup (covered by a separate Feature).
- Authentication, authorisation, or session management.
- Frontend oRPC client configuration (covered by the Frontend Feature).
- Docker / containerisation of the backend (covered by the Docker Compose Feature).
- OpenAPI spec generation or documentation endpoints.
- Production build optimisation or deployment configuration.
- CI/CD pipeline.

---

## Files Likely to Change
> Best-effort list based on current architecture knowledge. Not binding.

- `package.json` (root) — add `apps/backend` to the `workspaces` field
- `turbo.json` — add `dev` and `build` pipeline entries for backend
- `apps/backend/package.json` — new file
- `apps/backend/tsconfig.json` — new file (extends `@cv-tool/tsconfig/node.json`, strict mode on)
- `apps/backend/src/index.ts` — entry point, HTTP server bootstrap
- `apps/backend/src/router.ts` — oRPC router definition
- `apps/backend/src/procedures/health.ts` — health-check procedure with Zod schema
- `packages/contracts/package.json` — new shared package (`@cv-tool/contracts`)
- `packages/contracts/src/index.ts` — exports oRPC router type and health procedure Zod schemas
- `tsconfig.json` (root) — may need path references updated

---

## Dependencies
- **Feature #1 / Monorepo setup task** — The Turborepo monorepo structure and root `turbo.json` must already exist before this task can be completed. Confirm that task is merged before beginning.

---

> ℹ️ **Note for maintainers:** This file (`tasks/13-body.md`) is the canonical, version-controlled source of truth for the Task #13 issue body. The GitHub issue body is stale (contains the original draft with `pnpm-workspace.yaml`, `pnpm dev`, and `packages/api-contract` references). A human maintainer should copy the content of this file into the GitHub issue body at the earliest opportunity.
>
> **Revision history:**
> - Original draft: 2026-03-04 — Requirements Specialist
> - Revised: 2026-03-05 — ACs #1, #2, #3, #9, #10 and Files Likely to Change corrected per Architect (approved-with-notes, 2026-03-04) and Tester (needs-revision, 2026-03-05) feedback
> - Architect re-approval: 2026-03-05 — all 12 ACs verified against `architecture.md` and ADR-001 through ADR-004
