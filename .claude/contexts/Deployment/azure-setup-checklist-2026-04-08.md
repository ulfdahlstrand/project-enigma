# Azure Setup Checklist

Date: 2026-04-08
Repo: `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma`

## Goal

Create a practical Azure setup checklist for deploying the application after the Entra login migration is complete.

This checklist assumes the recommended target architecture:
- Frontend: Azure Static Web Apps
- Backend: Azure Container Apps
- Database: Azure Database for PostgreSQL Flexible Server
- Registry: Azure Container Registry
- Secrets: Azure Key Vault
- Monitoring: Azure Monitor + Log Analytics

## Suggested Environment Strategy

Create at least two environments:
- `staging`
- `prod`

Optional later:
- `dev`

Recommended naming:
- Resource group staging: `rg-enigma-staging`
- Resource group prod: `rg-enigma-prod`

Recommended region:
- choose one primary Azure region close to your users
- keep frontend, backend, database, and monitoring in the same region where possible

## Phase 1: Azure Foundation

### 1. Create resource groups

Create:
- `rg-enigma-staging`
- `rg-enigma-prod`

Checklist:
- [ ] staging resource group created
- [ ] prod resource group created

### 2. Create Log Analytics workspaces

Create one per environment, or one shared if you want to start simpler.

Suggested names:
- `log-enigma-staging`
- `log-enigma-prod`

Checklist:
- [ ] staging Log Analytics workspace created
- [ ] prod Log Analytics workspace created

### 3. Create Azure Container Registry

Suggested names:
- `acrenigmastaging`
- `acrenigmaprod`

Checklist:
- [ ] ACR created for staging
- [ ] ACR created for prod
- [ ] admin user disabled unless explicitly needed
- [ ] deployment identity permissions planned

### 4. Create Key Vaults

Suggested names:
- `kv-enigma-staging`
- `kv-enigma-prod`

Checklist:
- [ ] staging Key Vault created
- [ ] prod Key Vault created
- [ ] access policy or RBAC configured
- [ ] secret naming convention decided

Suggested secrets:
- `database-url`
- `jwt-secret`
- `openai-api-key`
- `entra-client-id`
- `entra-tenant-id`
- any other backend app secrets

## Phase 2: Database

### 5. Create Azure Database for PostgreSQL Flexible Server

Create one server per environment, or one server with separate databases if you want to start leaner.

Suggested names:
- `psql-enigma-staging`
- `psql-enigma-prod`

Checklist:
- [ ] staging PostgreSQL Flexible Server created
- [ ] prod PostgreSQL Flexible Server created
- [ ] database created
- [ ] admin username stored securely
- [ ] admin password stored in Key Vault
- [ ] firewall/network rules configured

Recommended first step:
- start with public access restricted to Azure services or known deployment addresses if needed

Recommended hardening later:
- move to private networking / private endpoint

Database tasks:
- [ ] create application database
- [ ] create application database user
- [ ] grant required permissions
- [ ] build production `DATABASE_URL`
- [ ] store `DATABASE_URL` in Key Vault

### 6. Define migration process

Choose one:
- CI/CD runs migrations before backend deploy
- Container Apps Job runs migrations

Recommended:
- CI/CD-managed migrations

Checklist:
- [ ] migration command documented
- [ ] migration credentials confirmed
- [ ] migration step planned for staging
- [ ] migration step planned for prod

## Phase 3: Backend Platform

### 7. Create Azure Container Apps Environment

Create one per environment.

Suggested names:
- `cae-enigma-staging`
- `cae-enigma-prod`

Checklist:
- [ ] staging Container Apps Environment created
- [ ] prod Container Apps Environment created
- [ ] linked to correct Log Analytics workspace

### 8. Create backend Container App

Suggested names:
- `ca-enigma-backend-staging`
- `ca-enigma-backend-prod`

Checklist:
- [ ] backend Container App created in staging
- [ ] backend Container App created in prod
- [ ] ingress enabled
- [ ] external HTTPS URL generated
- [ ] CPU/memory sizing chosen
- [ ] min/max replicas chosen

Recommended starting config:
- min replicas: `1`
- max replicas: `2` or `3`

Backend configuration checklist:
- [ ] image pulled from ACR
- [ ] `BACKEND_PORT` set
- [ ] `DATABASE_URL` sourced from Key Vault secret
- [ ] `JWT_SECRET` sourced from Key Vault secret
- [ ] `OPENAI_API_KEY` sourced from Key Vault secret
- [ ] `ENTRA_CLIENT_ID` configured
- [ ] `ENTRA_TENANT_ID` configured
- [ ] production CORS origin configured

### 9. Configure backend identity and registry access

Checklist:
- [ ] Container App identity enabled
- [ ] identity granted access to ACR
- [ ] identity granted access to Key Vault secrets

### 10. Configure backend health and observability

Checklist:
- [ ] health endpoint confirmed
- [ ] readiness/liveness behavior reviewed
- [ ] logs visible in Log Analytics
- [ ] restart/crash alerts planned

## Phase 4: Frontend Platform

### 11. Create Azure Static Web App

Suggested names:
- `swa-enigma-staging`
- `swa-enigma-prod`

Checklist:
- [ ] staging Static Web App created
- [ ] prod Static Web App created
- [ ] deployment method decided

Recommended deployment approach:
- GitHub Actions connected to the repo

Frontend configuration checklist:
- [ ] `VITE_API_URL` points to backend Container App URL
- [ ] `VITE_ENTRA_CLIENT_ID` configured
- [ ] `VITE_ENTRA_TENANT_ID` configured
- [ ] SPA route fallback configured

### 12. Configure frontend routing

Because the frontend is a SPA, direct navigation to routes must work.

Checklist:
- [ ] fallback route config added
- [ ] `/login` resolves on refresh
- [ ] authenticated routes resolve on refresh

## Phase 5: Identity and DNS

### 13. Finalize Entra app registration

For each deployed frontend URL:
- add the Static Web App hostname as redirect URI
- later add custom domain as redirect URI if used

Checklist:
- [ ] staging frontend URL added to Entra redirect URIs
- [ ] prod frontend URL added to Entra redirect URIs
- [ ] custom domain URI added if relevant

### 14. Configure custom domains

Recommended timing:
- after staging is stable

Checklist:
- [ ] frontend custom domain connected
- [ ] backend custom domain decided
- [ ] TLS/managed certificate configured

Optional:
- put Azure Front Door in front later if needed

## Phase 6: CI/CD

### 15. Create GitHub Actions workflows

Recommended workflows:

1. `ci.yml`
- lint
- typecheck
- tests

2. `deploy-staging.yml`
- build backend image
- push image to ACR
- run migrations
- deploy backend Container App
- deploy frontend Static Web App
- run smoke tests

3. `deploy-prod.yml`
- manual approval
- build or promote image
- run migrations
- deploy backend
- deploy frontend
- run smoke tests

Checklist:
- [ ] CI workflow created
- [ ] staging deploy workflow created
- [ ] prod deploy workflow created
- [ ] GitHub secrets or federated credentials configured

### 16. Decide deployment authentication method

Recommended:
- use workload identity federation / OIDC from GitHub to Azure

Fallback:
- service principal with secrets

Checklist:
- [ ] Azure auth from GitHub configured
- [ ] least-privilege roles assigned

## Phase 7: Application Configuration

### 17. Prepare production environment variables

Backend:
- [ ] `BACKEND_PORT`
- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `OPENAI_API_KEY`
- [ ] `ENTRA_CLIENT_ID`
- [ ] `ENTRA_TENANT_ID`
- [ ] allowed frontend origin(s)

Frontend:
- [ ] `VITE_API_URL`
- [ ] `VITE_ENTRA_CLIENT_ID`
- [ ] `VITE_ENTRA_TENANT_ID`

### 18. Production cookie and CORS review

Checklist:
- [ ] secure cookies enabled in production
- [ ] cookie domain/path reviewed
- [ ] SameSite policy reviewed
- [ ] CORS only allows deployed frontend origins

## Phase 8: Verification

### 19. Staging smoke test

Checklist:
- [ ] frontend loads
- [ ] backend health check works
- [ ] Entra login works
- [ ] `/auth/session` works after login
- [ ] logout works
- [ ] protected routes are protected
- [ ] backend can read/write database
- [ ] AI features work if expected

### 20. Production go-live checklist

Checklist:
- [ ] latest migrations applied
- [ ] staging validated successfully
- [ ] production secrets present
- [ ] production Entra redirect URIs configured
- [ ] custom domains verified
- [ ] alerts enabled
- [ ] backup/restore posture reviewed

## Nice-to-Have Follow-Up

After first successful deployment:
- [ ] move DB to private networking
- [ ] add Azure Front Door if needed
- [ ] add WAF if app is publicly exposed
- [ ] add uptime alerts
- [ ] add structured dashboards
- [ ] add deployment rollback runbook

## Suggested Build Order

If you want the most practical sequence:

1. Entra migration in app code
2. Production backend Dockerfile
3. Static Web App build output validation
4. Staging Azure resources
5. Staging deployment pipeline
6. Staging verification
7. Production Azure resources
8. Production deployment

## Portal Resource Summary

You will likely create these resources:

Staging:
- [ ] Resource Group
- [ ] Log Analytics Workspace
- [ ] Container Registry
- [ ] Key Vault
- [ ] PostgreSQL Flexible Server
- [ ] Container Apps Environment
- [ ] Backend Container App
- [ ] Static Web App

Production:
- [ ] Resource Group
- [ ] Log Analytics Workspace
- [ ] Container Registry
- [ ] Key Vault
- [ ] PostgreSQL Flexible Server
- [ ] Container Apps Environment
- [ ] Backend Container App
- [ ] Static Web App

## Recommended Next Step

The most useful next implementation artifact would be one of these:

1. A Bicep/Terraform resource list and scaffold
2. A GitHub Actions deployment workflow plan
3. A production Dockerfile plan for backend and frontend

Start with:
- staging resources
- production backend Dockerfile
- frontend Static Web App deployment configuration
