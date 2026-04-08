---
globs: ["apps/backend/**"]
---

# TypeScript — Backend

## Types
- Explicit types on all exported/public functions
- `unknown` over `any` — narrow before use
- Infer types from Zod schemas: `type Foo = z.infer<typeof fooSchema>`

## Error handling
- `async/await` with `try/catch` at every async boundary
- Log full error context server-side; surface only safe messages to client
- Never swallow errors silently

## Validation
- Zod at every system boundary (HTTP input, external API responses, file content)
- Fail fast with clear error messages
