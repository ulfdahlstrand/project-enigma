# Testing Runner

## Test Runner

Vitest is the sole test runner for all workspaces in the monorepo.

No other test runners are permitted without a dedicated ADR.

## Why Vitest

- native integration with Vite
- first-class TypeScript support
- Jest-compatible API
- built-in coverage via `v8`
- good monorepo performance

## Installation

`vitest` should be added as a `devDependency` to each workspace that contains
tests.

## Test Environment

| Workspace | Vitest environment | Reason |
|-----------|--------------------|--------|
| `@cv-tool/frontend` | `jsdom` | component tests require a DOM |
| `@cv-tool/backend` | `node` | server-side code runs in Node.js |
| `@cv-tool/contracts` | `node` | schema validation is runtime-agnostic |
