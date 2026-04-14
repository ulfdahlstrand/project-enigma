# Azure Deployment Plan

Date: 2026-04-08
Repo: `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma`

## Goal

Deploy the full application to Azure in a production-ready way after the Entra login migration is complete.

This plan is adapted to the current repo shape:
- React/Vite frontend in `apps/frontend`
- Node.js backend in `apps/backend`
- PostgreSQL database
- local Docker Compose setup only
- current Dockerfiles are development-only, not production-ready

## Recommended Target Architecture

Recommended production architecture:
- Frontend: Azure Static Web Apps
- Backend API: Azure Container Apps
- Database: Azure Database for PostgreSQL Flexible Server
- Secrets: Azure Key Vault
- Container image registry: Azure Container Registry
- Monitoring: Azure Monitor + Log Analytics
- Optional edge/security layer: Azure Front Door with WAF

Why this is the recommended architecture:
- The frontend is a Vite SPA, which is a strong fit for static hosting
- The backend is already a standalone Node.js service and is a good fit for Container Apps
- PostgreSQL should be moved to a managed database service instead of self-hosting in a container
- Secrets should not live in plain env files in production

## Fastest Alternative

If the goal is to get to Azure quickly with minimal architecture changes:
- Frontend: Azure Container Apps
- Backend: Azure Container Apps
- Database: Azure Database for PostgreSQL Flexible Server
- Registry: Azure Container Registry

This is the fastest path because both apps can be deployed as containers.

Tradeoff:
- Simpler initial migration
- Less optimal than Static Web Apps for the frontend
- Requires creating a real production frontend container image instead of serving a static build

## Current Repo Constraints

Current deployment blockers in the repo:

1. `docker/Dockerfile.frontend` is development-only
   - runs `npm run dev`
   - no production build stage
   - no static asset serving stage

2. `docker/Dockerfile.backend` is development-only
   - runs `npm run dev`
   - no compiled production start flow

3. `docker/docker-compose.yml` is local-dev oriented
   - includes local database
   - includes local migration container
   - bind mounts local source code
   - uses localhost assumptions in the frontend API URL

Before production deployment, these need dedicated production replacements.

## Recommended Azure Services

### 1. Frontend: Azure Static Web Apps

Use for the built Vite frontend.

Recommended because:
- the frontend is a static SPA
- Azure Static Web Apps is designed for static frontends
- custom domains and TLS are straightforward

Frontend deployment artifact:
- built output from `apps/frontend/dist`

Required work:
- ensure `npm run build --workspace=apps/frontend` produces a complete production build
- ensure `VITE_API_URL` points to the deployed backend URL
- configure SPA routing fallback so client-side routes resolve correctly

### 2. Backend: Azure Container Apps

Use for the Node.js API.

Recommended because:
- backend is already an independent service
- Container Apps supports HTTPS ingress, autoscaling, revisions, secrets, and Log Analytics
- fits the repo better than AKS for current complexity

Backend deployment artifact:
- a production-ready Linux container image

Required work:
- create a production Dockerfile for the backend
- compile TypeScript during image build
- run compiled output with `node dist/index.js`
- define health endpoint behavior clearly for Azure health probes

### 3. Database: Azure Database for PostgreSQL Flexible Server

Use instead of running PostgreSQL in a container.

Recommended because:
- managed backups
- managed patching
- built-in scaling and HA options
- better operational safety than self-hosting Postgres in Container Apps

Recommended networking:
- start with public access + restricted firewall if speed matters
- move to private networking / private endpoint for stronger production isolation

### 4. Secrets: Azure Key Vault

Use for:
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- Entra-related secrets or configuration values if needed later

Container Apps can use secrets and managed identity, and Key Vault should be the long-term source of truth for secrets.

### 5. Registry: Azure Container Registry

Use to store backend container images.

Optional:
- also store frontend image if you choose the all-container deployment path

### 6. Monitoring

Use:
- Azure Monitor
- Log Analytics

Track at minimum:
- backend container logs
- restart/crash events
- response latency
- failed login attempts
- database CPU/storage/connection metrics

### 7. Optional Edge Layer

Use Azure Front Door later if needed for:
- WAF
- custom edge routing
- global acceleration
- cleaner multi-origin setup

This is optional for the first production deployment.

## Recommended Production Build Changes

### Frontend

Two deployment options:

#### Option A: Static Web Apps

Recommended.

Changes needed:
- add a deployment workflow that installs dependencies and runs the frontend build
- publish `apps/frontend/dist`
- ensure SPA route fallback is configured

#### Option B: Containerized frontend

Only if choosing Container Apps for the frontend.

Changes needed:
- create a new production Dockerfile
- build static assets with Vite
- serve them with Nginx or another static file server

### Backend

Create a production Dockerfile, for example:
- build stage installs dependencies and compiles TypeScript
- runtime stage contains only what is needed to run the compiled server

Behavioral target:
- no bind mounts
- no watch mode
- no local dev assumptions
- startup command should be production-safe

### Root deployment scripts

Recommended additions:
- `npm run build --workspace=apps/frontend`
- `npm run build --workspace=apps/backend`
- a documented migration command for production

## Database and Migrations Plan

The database should not be deployed as a container in production.

Recommended plan:
1. Create Azure Database for PostgreSQL Flexible Server
2. Create one production database
3. Create one staging database or a separate staging server
4. Store connection strings in Key Vault
5. Run migrations as a controlled deployment step

Migration execution options:
- best option: run migrations in CI/CD before backend rollout
- alternative: run migrations via a dedicated Azure Container Apps Job

Important rule:
- do not rely on app startup to run migrations automatically in production

## Environments

Recommended environment split:
- `dev`
- `staging`
- `prod`

For each environment define:
- frontend URL
- backend URL
- database
- Key Vault
- Container Apps app
- monitoring/logging targets

Suggested naming pattern:
- `enigma-dev-*`
- `enigma-staging-*`
- `enigma-prod-*`

## CI/CD Plan

Recommended pipeline structure:

1. Pull request checks
- lint
- typecheck
- unit tests
- backend tests
- frontend tests

2. Build pipeline on merge to `dev`
- build frontend
- build backend
- build/push backend image to ACR
- optionally deploy to staging

3. Release pipeline to production
- run migrations
- deploy backend revision to Container Apps
- deploy frontend to Static Web Apps
- run smoke tests

Recommended smoke checks:
- frontend loads
- backend `/health` or equivalent responds
- login page works
- authenticated flow works

## Infrastructure as Code

Recommended:
- define Azure resources with Bicep or Terraform

Minimum resources to codify:
- Resource group
- Log Analytics workspace
- Container Apps environment
- Backend Container App
- Azure Container Registry
- PostgreSQL Flexible Server
- Key Vault
- Static Web App
- optional Front Door

Avoid hand-built production infrastructure in the portal once the first proof of concept is done.

## Security Plan

Minimum production security posture:
- use Entra login only
- use HTTPS everywhere
- store secrets in Key Vault
- restrict database access
- enable managed identity where possible
- rotate secrets
- add WAF later if the app becomes externally exposed beyond internal use

Recommended backend hardening:
- verify CORS origins per environment
- restrict cookies appropriately for production
- set secure cookie flags in production
- restrict allowed frontend origin to deployed frontend hostnames

## Delivery Plan

### Phase 1: Production readiness in repo
- create production Dockerfile for backend
- decide frontend hosting strategy
- add environment-specific config support
- remove local-only deployment assumptions

### Phase 2: Azure foundation
- create resource groups
- create ACR
- create Log Analytics workspace
- create Container Apps environment
- create PostgreSQL Flexible Server
- create Key Vault

### Phase 3: Staging deployment
- deploy backend to Container Apps
- deploy frontend to Static Web Apps
- connect backend to Postgres
- run migrations
- validate Entra login in staging

### Phase 4: Production deployment
- provision prod resources
- configure custom domains
- enable TLS
- deploy production build
- validate smoke tests

### Phase 5: Hardening
- private networking for database
- managed identities
- alerting
- Front Door + WAF if needed

## Concrete Repo Tasks

Likely implementation tasks in this repo:

1. Add `docker/Dockerfile.backend.prod`
2. Add either:
   - Static Web Apps build workflow
   - or `docker/Dockerfile.frontend.prod`
3. Add deployment docs under `docs/`
4. Add Azure env var examples to `.env.example`
5. Review backend health endpoint behavior
6. Add infra-as-code directory, for example:
   - `infra/azure/`
7. Add CI/CD workflows under `.github/workflows/`

## Recommended Decision

Recommended first production architecture:
- Frontend on Azure Static Web Apps
- Backend on Azure Container Apps
- PostgreSQL on Azure Database for PostgreSQL Flexible Server

Reason:
- best balance between operational simplicity, cost, and fit with the current codebase

## Official Microsoft References

These recommendations are based on Microsoft documentation:

- Azure Container Apps overview:
  - https://learn.microsoft.com/en-us/azure/container-apps/overview
- Azure Container Apps lifecycle and revisions:
  - https://learn.microsoft.com/en-us/azure/container-apps/application-lifecycle-management
- Managed identities in Azure Container Apps:
  - https://learn.microsoft.com/en-us/azure/container-apps/managed-identity
- Azure Container Registry concepts:
  - https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
- Azure Database for PostgreSQL Flexible Server overview:
  - https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compare-single-server-flexible-server
- Azure Database for PostgreSQL networking:
  - https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private
  - https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-public
- Azure Key Vault overview:
  - https://learn.microsoft.com/en-us/azure/key-vault/general/overview
- Azure Front Door overview:
  - https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview

## Recommended Next Step

Decide between:
- recommended architecture: Static Web Apps + Container Apps
- fastest path: Container Apps for both frontend and backend

After that, the next practical work item should be:
- add a production backend Dockerfile
- choose frontend hosting mode
- scaffold Azure infrastructure as code
