# Project Enigma — Claude Instructions

## Project Overview

A consultant resume creation and maintenance tool. Consultants manage structured
resumes with assignments, export to PDF/DOCX, and maintain multiple language and
role variants. Managers track customer demands and match consultants to engagements.

## Tech Stack

| Layer       | Technology                                                  |
|-------------|-------------------------------------------------------------|
| Monorepo    | Turborepo + npm workspaces                                  |
| Frontend    | React 19, Vite, TanStack Router, TanStack Query, MUI        |
| API         | oRPC (type-safe RPC)                                        |
| Validation  | Zod (schemas live in `packages/contracts`)                  |
| Backend     | Node.js + TypeScript strict                                 |
| Database    | PostgreSQL 16 via Kysely                                    |
| Auth        | Google OAuth + JWT                                          |
| i18n        | react-i18next (EN + SV locales)                             |
| Testing     | Vitest + React Testing Library                              |

## Workspace Structure

```
apps/frontend/       React SPA
apps/backend/        Node.js oRPC server
packages/contracts/  Shared Zod schemas + oRPC types
packages/tsconfig/   Shared TS config
```

## Running the Project

```bash
docker compose up                    # full stack (Docker required)
cd apps/frontend && npm run dev
cd apps/backend && npm run dev
cd apps/backend && npm run migrate
```

## Project-Specific Conventions

These **override or extend** the global ECC rules:

- **JSX text**: always via `useTranslation("common")` — no plain string literals as JSX children
- **Styling**: MUI `sx` prop only — no CSS/SCSS files, no `style={{}}` props
- **API calls**: oRPC client + TanStack Query — never raw `fetch` or `axios`
- **DB access**: Kysely only, dependency-injected into procedures for testability
- **Routes**: plural convention — `/resumes`, `/employees`, etc.
- **File naming**: `kebab-case` for utilities/routes, `PascalCase` for React components

## Git Workflow (project override)

> The global ECC git rules apply, with these project-specific additions:

- **PRs always target `dev`**, NEVER `main`. Always pass `--base dev` to `gh pr create`.
- `main` is production-only; it receives code from `dev` after QA.
- One commit per task (GitHub issue), one PR per feature (multiple task commits).
- Push branch after every completed feature.

## Tooling

- Use **everything-claude-code (ECC)** agents for all orchestration and planning.
- Use **`gh` CLI** (Bash) for all GitHub operations (issues, PRs, labels).
- Do **NOT** use `mcp__flower__*` or `mcp__flower-orchestrator__*` tools.

## Implementation Phases — follow in order

Phases are tracked as GitHub Milestones. Never implement a later phase before an earlier one is complete.

### Phase 1 — Auth & Foundation
Issues: #203, #211–#213, #230–#234. All other phases depend on this.

### Phase 2 — Core Resume & Assignment Data
Issues: #204–#205, #214–#219, #235–#243. Requires Phase 1.

### Phase 3 — Upload, AI & Customer Demands
Issues: #206–#207, #217, #220–#223, #240, #244–#251. Requires Phase 2.

### Phase 4 — Export, Variants & Smart Suggestions
Issues: #208–#210, #224–#229, #252–#261. Requires Phase 2.

## GitHub Issue Labels

- `type:epic` — large body of work
- `type:feature` — mid-level feature (part of an epic)
- `type:task` — single implementable unit (part of a feature)
- `status:backlog` → `status:ready-for-dev` → `status:in-progress` → `status:in-review` → `status:done`

## Open Questions

- Auth: CLAUDE.md originally referenced Azure AD/MSAL; implementation uses Google OAuth. Which is canonical?
- Employee rename (#279): which phase/milestone does this belong to?
