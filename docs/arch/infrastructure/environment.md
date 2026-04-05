# Infrastructure Environment

## Environment Configuration

- each app reads configuration from environment variables
- no hardcoded hostnames, ports, or credentials in source code
- `.env.example` files are maintained for local setup
- frontend client-exposed variables use the `VITE_` prefix
- backend variables use service-oriented names such as `DATABASE_URL`

## Integration Test Database Safety

Backend integration tests must use a dedicated `TEST_DATABASE_URL`.

The safety checks live in:

- `apps/backend/src/test-helpers/integration-db.ts`

These tests are intentionally blocked if:

- `TEST_DATABASE_URL` is missing
- `TEST_DATABASE_URL` matches `DATABASE_URL`
