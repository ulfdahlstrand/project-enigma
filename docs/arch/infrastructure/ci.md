# Infrastructure CI

## CI/CD

The CI pipeline runs on pull requests targeting `main` and `dev` via GitHub
Actions.

## Pipeline Steps

| Step | Command | Scope |
|---|---|---|
| Install dependencies | `npm ci` | Repo root |
| Build contracts | `npm run build --workspace=packages/contracts` | Shared package |
| Build utils | `npm run build --workspace=packages/utils` | Shared package |
| Type check contracts | `npx tsc --noEmit -p packages/contracts/tsconfig.json` | Contracts |
| Type check backend | `npx tsc --noEmit -p apps/backend/tsconfig.json` | Backend |
| Type check frontend | `npx tsc --noEmit -p apps/frontend/tsconfig.json` | Frontend |
| Vitest backend | `npx vitest run` in `apps/backend` | Backend |
| Vitest frontend | `npx vitest run` in `apps/frontend` | Frontend |

## Pull Request Workflow

Project workflow currently targets `dev` for normal feature work. `main` is not
the default day-to-day PR target.
