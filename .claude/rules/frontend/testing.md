---
globs: ["apps/frontend/**"]
---

# Frontend Testing

## Stack
- **Unit/integration**: Vitest + React Testing Library
- **E2E**: Playwright — use **e2e-runner** agent

## Rules
- Test behaviour, not implementation — query by role/label, not test-id
- Mock at module boundaries, not internals
- 80% coverage minimum; critical user flows must have E2E tests
