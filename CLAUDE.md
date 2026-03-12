# Project Enigma — Claude Instructions

## Project Overview

A consultant CV creation and maintenance tool. Consultants manage structured CVs with assignments, export to PDF/DOCX, and maintain multiple language and "angled" variants (e.g. Tech Lead, Architect). Managers track customer demands and match consultants to engagements.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + npm workspaces |
| Frontend | React 19, Vite, TanStack Router, TanStack Query, Material UI |
| API | oRPC (type-safe RPC with OpenAPI) |
| Validation | Zod |
| Backend | Node.js + TypeScript strict |
| Database | PostgreSQL 16 via Kysely |
| i18n | react-i18next (EN + SV) |
| Testing | Vitest |

## Implementation Order — ALWAYS follow this phase sequence

Phases are tracked as GitHub Milestones. **Never implement a later phase before an earlier one is complete.**

### Phase 1: Authentication & Foundation (Milestone 1)
**Issues: #203, #211–#213, #230–#234**

Dependencies: none — start here.

1. Register Azure AD app (#230)
2. Frontend MSAL login flow (#231)
3. Backend JWT validation middleware (#232)
4. Users table + first-login provisioning (#233)
5. Frontend route guards (#234)
6. RBAC roles enforced on API (#212)
7. Protected routes wired up (#213)

> All other phases require authenticated users. Do not skip.

---

### Phase 2: Core CV & Assignment Data (Milestone 2)
**Issues: #204–#205, #214–#219, #235–#243**

Dependencies: Phase 1 complete.

Order within phase:
1. CV database schema migration (#235)
2. Assignment database migration (#241)
3. CV CRUD API procedures (#236, #237)
4. Assignment CRUD API procedures (#242)
5. CV list and detail pages (#238)
6. CV editor form (#239)
7. Assignment list and edit UI (#243)

---

### Phase 3: Upload, AI & Customer Demands (Milestone 3)
**Issues: #206–#207, #217, #220–#223, #240, #244–#251**

Dependencies: Phase 2 complete (CV and assignment schema must exist).

Order within phase:
1. File upload endpoint (#240)
2. Customer + demand schema (#244)
3. Demand CRUD API (#245)
4. Demand management UI (#246)
5. AI provider infrastructure (#247)
6. `improveDescription` streaming procedure (#248)
7. AI improve button in UI (#249)
8. AI assignment extraction procedure (#250)
9. Extracted assignments review UI (#251)

---

### Phase 4: Export, Variants & Smart Suggestions (Milestone 4)
**Issues: #208–#210, #224–#229, #252–#261**

Dependencies: Phase 2 complete; Phase 3 AI infrastructure recommended.

Order within phase:
1. PDF generation service (#252)
2. DOCX generation service (#254)
3. Export buttons in CV UI (#253)
4. CV variants schema migration (#255)
5. CV variant CRUD API (#256)
6. Variant selector UI (#257)
7. Language selector for CV (#258)
8. CV version history + diff storage (#259)
9. Suggestion generation procedure (#260)
10. Suggestion review UI (#261)

---

## Key Conventions

- **No hardcoded strings in JSX** — always use i18n keys (`useTranslation`)
- **Styling** — MUI `sx` prop only, no CSS/SCSS files
- **API calls** — use oRPC client + TanStack Query, never raw fetch
- **Mutations** — always immutable (return new objects, never mutate in place)
- **Validation** — Zod schemas in `packages/contracts`, shared between frontend and backend
- **Tests** — write tests first (TDD), 80% coverage minimum
- **Database access** — Kysely only, dependency-injected into procedures for testability
- **File naming** — `kebab-case` for utilities/routes, `PascalCase` for React components

## Workspace Structure

```
apps/frontend/     React SPA
apps/backend/      Node.js oRPC server
packages/contracts/  Shared Zod schemas + oRPC types
packages/database/   Migrations
packages/tsconfig/   Shared TS config
```

## Running the Project

```bash
# Start everything (Docker required)
docker compose up

# Frontend only
cd apps/frontend && npm run dev

# Backend only
cd apps/backend && npm run dev

# Run migrations
cd apps/backend && npm run migrate
```

## GitHub Issue Labels

- `type:epic` — large body of work (one per major feature area)
- `type:feature` — mid-level feature (Part of an Epic)
- `type:task` — single implementable unit (Part of a Feature)
- `status:backlog` → `status:ready-for-dev` → `status:in-progress` → `status:in-review` → `status:done`
