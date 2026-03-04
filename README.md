# CV Creation Tool

A web-based application that allows consultants to efficiently manage, tailor, and export their CVs for specific client assignments.

Built as a Turborepo monorepo with a React frontend, Node.js backend, and PostgreSQL database — all orchestrated locally via Docker Compose.

---

## Local Development

Follow these steps to get the full local development stack running with a single command.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Docker Compose v2)
- [Git](https://git-scm.com/)

### Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd project-enigma
   ```

2. **Copy the environment variable template**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and replace any placeholder values (notably `POSTGRES_PASSWORD` and the password component of `DATABASE_URL`) with your own. The defaults are safe for local development but should never be used in any shared or production environment.

3. **Start all services**

   From the `docker/` directory:

   ```bash
   cd docker
   docker compose up
   ```

   Or from the repository root using the `-f` flag:

   ```bash
   docker compose -f docker/docker-compose.yml up
   ```

   Docker Compose will build the frontend and backend images and start three services:

   | Service    | Description                   | Default port |
   |------------|-------------------------------|-------------|
   | `frontend` | React dev server (hot-reload) | 5173        |
   | `backend`  | Node.js API server            | 3001        |
   | `db`       | PostgreSQL 16 database        | 5432 (internal only) |

4. **Access the application**

   - **Frontend:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:3001](http://localhost:3001)

5. **Stop all services**

   From the `docker/` directory:

   ```bash
   docker compose down
   ```

   Or from the repository root:

   ```bash
   docker compose -f docker/docker-compose.yml down
   ```

   > **Note:** PostgreSQL data is persisted in a named Docker volume (`postgres_data`) and survives `docker compose down` / `docker compose up` cycles. To also remove the volume and start with a fresh database, run `docker compose down -v`.

---

## Project Structure

```
/
├── apps/
│   ├── frontend/     # @cv-tool/frontend — React SPA
│   └── backend/      # @cv-tool/backend  — Node.js oRPC server
├── packages/
│   ├── tsconfig/     # @cv-tool/tsconfig  — Shared TypeScript configs
│   └── contracts/    # @cv-tool/contracts — Shared oRPC types & Zod schemas
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.frontend
│   └── Dockerfile.backend
└── docs/
    └── architecture.md
```

---

## Documentation

- [Architecture](docs/architecture.md)
- [Technical Decisions (ADR log)](docs/tech-decisions.md)
