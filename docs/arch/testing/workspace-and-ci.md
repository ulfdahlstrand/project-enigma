# Testing Workspace and CI

## Turborepo

The `test` task is registered in `turbo.json`.

Key points:

- tests may depend on upstream package builds
- coverage output may be cached by Turborepo

## npm Scripts

Typical commands:

- root: `npm test`
- workspace: `npx vitest run`
- workspace watch mode: `npx vitest`

## Deferred Decisions

The following remain future decisions unless documented elsewhere:

- E2E framework strategy
- broader live-database integration test strategy
- network interception tooling
- any changes to CI test coverage beyond the current GitHub Actions pipeline
