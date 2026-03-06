# Infrastructure Architecture

> Sub-document of [architecture.md](../architecture.md). Covers hosting, CI/CD, environments, deployment, Docker, and Turborepo pipeline.

## Docker Compose — Local Development Entrypoint

Running `docker compose up` (from `docker/`) must start the full local stack (ADR-004):

- **PostgreSQL** database
- **Backend** API server
- **Frontend** dev server (with hot module reload)

No local service should require manual startup outside of Docker Compose for standard development.

### Docker Files

All Docker-related files live in `docker/`:

```
docker/
├── Dockerfile.frontend
├── Dockerfile.backend
└── docker-compose.yml
```

No `Dockerfile` or `docker-compose.yml` at the repo root.

---

## Turborepo Pipeline

`turbo.json` defines the task pipeline (ADR-001):

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Key Rules

- `build` must declare `"dependsOn": ["^build"]` so `@cv-tool/contracts` is always built before consuming apps.
- All tasks must be run via `turbo run <task>` from the repo root (or via root `package.json` scripts).
- Local caching is enabled by default; remote caching is out of scope for the initial setup.

---

## Environment Configuration

- Each app reads configuration from environment variables. No hardcoded hostnames, ports, or credentials in source code.
- A `.env.example` file is maintained at each app root and at the repo root for Docker Compose variables.
- Frontend client-exposed variables must use the `VITE_` prefix (e.g. `VITE_API_URL`).
- Backend variables use a service prefix (e.g. `BACKEND_PORT`, `DATABASE_URL`).
- Variable naming: `SCREAMING_SNAKE_CASE`.

---

## CI/CD

> CI/CD pipeline details will be documented here when the relevant ADR is recorded.

---

## Production Deployment

> Production hosting and deployment decisions are out of scope for the initial setup and will be documented here when decided.
