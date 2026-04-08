---
globs: ["apps/backend/**"]
---

# Backend Testing

## Stack
- **Unit**: Vitest
- **Integration**: Vitest + real database (no DB mocks — mocked tests have hidden prod divergence)

## Rules
- Test at the HTTP handler level for API routes
- 80% coverage minimum
- Seed test data deterministically; clean up after each test
