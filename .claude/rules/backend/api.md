---
globs: ["apps/backend/**"]
---

# Backend API

## Response envelope
```
{ success: boolean, data?: T, error?: string, meta?: { total, page, limit } }
```

## Rules
- Parameterized queries only — never string-interpolated SQL
- Rate limiting on all public endpoints
- Error messages must not leak stack traces, internal paths, or DB schema
- Authentication/authorization checked before any data access
