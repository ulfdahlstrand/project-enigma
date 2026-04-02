# Backend Database

## Database Access

- Only `apps/backend/` connects to PostgreSQL.
- The frontend never accesses the database directly.
- All data access is mediated through oRPC procedures.
- Schema and migrations are documented in [data-model.md](../data-model.md).

## Kysely

Kysely is the database client for all backend database access. It is a
type-safe SQL query builder, not an ORM.

### Dependencies

| Package | Purpose |
|---------|---------|
| `kysely` | Core query builder |
| `pg` | PostgreSQL driver used by the Kysely PostgreSQL dialect |

## Kysely Instance

A single `Kysely` instance is created in `apps/backend/src/db/client.ts` and
exported for use by procedure handlers.

## Database Type Definitions

All table types are defined in `apps/backend/src/db/types.ts`. The committed
`types.ts` file is the TypeScript source of truth.

## Query Patterns

All database queries in procedure handlers must use the Kysely query builder.

Prohibited patterns:

- raw SQL string concatenation
- direct use of `pg` clients for normal queries
- additional ORMs or query builders alongside Kysely
