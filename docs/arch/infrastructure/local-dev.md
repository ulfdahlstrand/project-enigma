# Infrastructure Local Development

## Docker Compose

Running `docker compose up` from `docker/` must start the full local stack:

- PostgreSQL database
- backend API server
- frontend dev server with HMR

All Docker-related files live in `docker/`.

## Turborepo Pipeline

`turbo.json` defines the task pipeline.

Key rules:

- `build` depends on upstream builds so shared packages are built first
- tasks are run via `turbo run <task>` or root package scripts
- local caching is enabled by default
