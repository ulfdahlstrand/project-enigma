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

## Migrations (ADR-011)

Database schema changes are managed via **Kysely's built-in Migrator**, using TypeScript migration files.

### Migration Runner

The migration runner is Kysely's `Migrator` class, configured with a `FileMigrationProvider` pointing to the migrations directory. A CLI script (`apps/backend/src/db/migrate.ts`) is provided to run migrations:

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";
import { FileMigrationProvider, Migrator } from "kysely";
import { db } from "./client.js";

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, "migrations"),
  }),
});

// Run all pending migrations
const { error, results } = await migrator.migrateToLatest();
```

A `migrate` script must be defined in `apps/backend/package.json`:

```json
{
  "scripts": {
    "migrate": "tsx src/db/migrate.ts"
  }
}
```

This script is run:
- Manually during development: `npm run migrate -w apps/backend`
- Automatically as part of the Docker Compose startup sequence (backend entrypoint runs migrations before starting the server)

### Migration File Format

Migration files are **TypeScript** files located in `apps/backend/src/db/migrations/`.

#### Naming Convention

Files use a **timestamp-prefixed** naming convention to guarantee deterministic ordering:

```
YYYYMMDDHHMMSS_description.ts
```

Examples:
- `20260307120000_create_employees.ts`
- `20260307130000_add_email_to_employees.ts`

#### File Structure

Each migration file must export an `up` function and a `down` function:

```typescript
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("employees")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(db.fn("gen_random_uuid")))
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("role", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("employees").execute();
}
```

#### Migration Rules

1. **Every schema change requires a new migration file.** No manual `ALTER TABLE` against the running database.
2. **Migrations are append-only.** Never edit a migration that has already been applied. To fix a mistake, create a new migration.
3. **Both `up` and `down` must be implemented.** The `down` function must reverse the `up` function to support rollbacks.
4. **Use Kysely's schema builder** for DDL operations (create table, alter table, create index, etc.). Raw SQL via `sql` tagged template is acceptable for operations Kysely's schema builder does not support (e.g. creating custom types), but must use parameterised queries.
5. **No data seeding in migrations.** Seed data (if needed) uses a separate mechanism, not migration files.
6. **The `db` parameter is typed as `Kysely<unknown>`** — migrations must not depend on the application's `Database` type interface, because that interface represents the current schema state, not the state at the time the migration was written.

### Migration Tracking

Kysely's Migrator automatically creates and manages a `kysely_migration` table in the database to track which migrations have been applied. This table must not be modified manually.

---

## Database Client

The database client is **Kysely** — a type-safe SQL query builder for TypeScript (ADR-011). See [backend.md](./backend.md) for full usage patterns, dependencies, and query examples.

**Constraints (from ADR-006, enforced by ADR-011):**
- Must support TypeScript — ✅ Kysely is TypeScript-native.
- Must use parameterised queries (no string concatenation) — ✅ Kysely generates parameterised SQL by default.

---

## Schema Conventions

The following conventions apply to all database tables:

### Column Naming

- Use `snake_case` for all column names (e.g. `created_at`, `employee_id`).
- Primary keys are named `id`.
- Foreign keys are named `<referenced_table_singular>_id` (e.g. `employee_id`).

### Standard Columns

Every table should include:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key. Default: `gen_random_uuid()` |
| `created_at` | `timestamptz` | Row creation timestamp. Default: `now()` |
| `updated_at` | `timestamptz` | Last update timestamp. Default: `now()` |

### Type Conventions

- Use `uuid` for primary keys (not auto-incrementing integers).
- Use `timestamptz` (timestamp with time zone) for all date/time columns.
- Use `varchar(n)` with explicit length for bounded strings; `text` for unbounded strings.
- Use `boolean` for true/false flags (not integers).

---

## Schema

> Schema details will be documented here as data model features are implemented.
