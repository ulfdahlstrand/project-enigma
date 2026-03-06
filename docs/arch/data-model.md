# Data Model Architecture

> Sub-document of [architecture.md](../architecture.md). Covers database, schema, and migrations.

## Database — PostgreSQL

PostgreSQL (version 16 or later) is the sole persistent data store (ADR-006).

### Local Development

- Runs as a Docker container (`postgres:16` image or later) managed by Docker Compose.
- Must be running for the backend to function locally.

### Connection

- Backend connects via a `DATABASE_URL` environment variable (standard PostgreSQL connection string).
- `DATABASE_URL` must be configured in Docker Compose and in `.env.example` files.

### Access Pattern

- Only `apps/backend/` connects to PostgreSQL.
- The frontend **never** accesses the database directly — all data access is mediated through oRPC procedures.

---

## Migrations

- Database schema changes are managed via migration scripts.
- Scripts use a **timestamp-prefixed naming convention** (`YYYYMMDDHHMMSS_description.sql`) to guarantee deterministic ordering.
- No manual `ALTER TABLE` against the running database — every change requires a migration file.
- The specific migration tool/runner is to be decided and recorded as a separate ADR.
- Until a tool is chosen, migration scripts can be plain `.sql` files run in order.

---

## Database Client

- The choice of database client (raw SQL, query builder like Kysely, or a lightweight ORM) is deferred to backend/database feature tasks.
- **Constraint:** The client must support TypeScript and parameterised queries (no string concatenation for SQL).

---

## Schema

> Schema details will be documented here as data model features are implemented.
