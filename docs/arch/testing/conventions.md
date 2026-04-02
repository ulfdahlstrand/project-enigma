# Testing Conventions

## File Location

Tests are co-located with the source files they test.

```text
src/
├── services/
│   ├── cv-service.ts
│   ├── cv-service.test.ts
│   └── cv-service.integration.test.ts
├── components/
│   ├── CvCard.tsx
│   └── CvCard.test.tsx
└── test-utils/
```

## Naming

| File type | Pattern |
|-----------|---------|
| Unit test | `<source-file>.test.ts(x)` |
| Integration test | `<source-file>.integration.test.ts` |
| Test utility | descriptive `kebab-case` |

## Rules

- prefer co-located tests next to the source they cover
- the repo still contains legacy `__tests__/` directories, so do not move test files just to satisfy the convention
- test file names should match the source file they test
- `.integration.test.ts` files may depend on external systems
