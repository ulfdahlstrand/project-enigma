# Azure Infrastructure as Code Plan

Date: 2026-04-08
Repo: `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma`

## Goal

Document the recommended automation strategy for deploying the application to Azure using infrastructure as code.

Recommended automation stack:
- `Bicep` for Azure resource definitions
- `azd` (Azure Developer CLI) for environment-aware provisioning and deployment
- `GitHub Actions` for CI/CD automation
- `az` (Azure CLI) as a low-level fallback and debugging tool

## Recommendation Summary

Use this combination:

1. `Bicep`
- define Azure resources declaratively
- version infrastructure in git
- make environments reproducible

2. `azd`
- orchestrate provision + deploy workflows
- manage staging/prod environments
- standardize Azure developer operations

3. `GitHub Actions`
- automate build, test, provision, and deploy
- trigger staging/prod workflows from branch strategy

4. `az`
- use when a direct CLI command is needed
- use for troubleshooting or one-off admin tasks

## Why This Stack Fits This Repo

This repo is a multi-service application with:
- frontend
- backend
- database
- secrets
- authentication integration

That means plain `az` scripts alone would work, but would become brittle over time.

Using `azd + Bicep` gives:
- repeatable infra provisioning
- environment-aware deployment
- easier onboarding
- cleaner path to staging and production

## Recommended Directory Structure

Suggested structure to add to the repo:

```text
infra/
  azure/
    main.bicep
    modules/
      resource-group.bicep
      log-analytics.bicep
      acr.bicep
      key-vault.bicep
      postgres-flex.bicep
      container-app-env.bicep
      backend-container-app.bicep
      static-web-app.bicep
      monitoring.bicep
```

At the repo root:

```text
azure.yaml
.azure/
  staging/.env
  prod/.env
```

And CI/CD:

```text
.github/workflows/
  ci.yml
  deploy-staging.yml
  deploy-prod.yml
```

## Recommended `azd` Role

Use `azd` as the top-level entrypoint for Azure lifecycle tasks.

Typical commands:

```bash
azd auth login
azd env new staging
azd env new prod
azd provision
azd deploy
azd up
```

Recommended usage:
- `azd provision` creates or updates infra
- `azd deploy` deploys app artifacts
- `azd up` is useful for first-time bring-up

## Recommended `azure.yaml` Shape

The `azure.yaml` file should describe the application services and map them to Azure deployment behavior.

Suggested services:
- `frontend`
- `backend`

Recommended intent:
- backend deploys to Azure Container Apps
- frontend deploys either:
  - to Azure Static Web Apps
  - or as a separate deploy step in GitHub Actions if `azd` support is easier to keep custom

Important note:
- for this repo, the frontend and backend likely need different deployment strategies
- the backend fits `azd` + container deployment very naturally
- the frontend may be easiest to deploy via a dedicated Static Web Apps GitHub action even if infra is still provisioned with Bicep

## Recommended Bicep Modules

### 1. `log-analytics.bicep`

Provision:
- Log Analytics workspace

Outputs:
- workspace resource ID
- workspace name

### 2. `acr.bicep`

Provision:
- Azure Container Registry

Outputs:
- login server
- registry resource ID

### 3. `key-vault.bicep`

Provision:
- Azure Key Vault

Outputs:
- vault URI
- vault name

### 4. `postgres-flex.bicep`

Provision:
- Azure Database for PostgreSQL Flexible Server
- database
- optional firewall/network rules

Outputs:
- server hostname
- database name

### 5. `container-app-env.bicep`

Provision:
- Azure Container Apps Environment

Outputs:
- environment ID

### 6. `backend-container-app.bicep`

Provision:
- backend Container App
- ingress
- secret references
- managed identity
- registry access

Outputs:
- backend URL

### 7. `static-web-app.bicep`

Provision:
- Azure Static Web App

Outputs:
- frontend hostname
- deployment token or integration references if needed

### 8. `monitoring.bicep`

Optional first version:
- action groups
- alerts
- dashboards later

## Recommended Environment Parameters

Bicep should accept parameters per environment for:
- environment name
- location
- app name prefix
- backend container sizing
- postgres SKU and storage
- allowed origins
- custom domain settings later

Suggested examples:
- `environmentName=staging`
- `environmentName=prod`
- `location=swedencentral` or chosen Azure region

## Recommended Secrets Handling

Use Key Vault for secrets.

Examples:
- `database-url`
- `jwt-secret`
- `openai-api-key`
- `entra-client-id`
- `entra-tenant-id`

Recommended runtime behavior:
- backend Container App reads secrets through Container Apps secret configuration
- use managed identity where possible

Do not:
- store production secrets directly in committed env files
- hardcode secrets in Bicep

## Recommended Deployment Flow

### Local or manual bootstrap

For initial environment creation:

```bash
azd auth login
azd env new staging
azd provision
```

Then populate secrets and deploy:

```bash
azd deploy
```

### Staging CI/CD

On merge to `dev`:
- run tests
- build backend image
- push backend image to ACR
- run migrations
- deploy backend
- deploy frontend
- run smoke tests

### Production CI/CD

On release/manual approval:
- reuse or promote known-good image
- run migrations
- deploy backend
- deploy frontend
- run smoke tests

## Recommended GitHub Actions Split

### `ci.yml`

Run:
- lint
- typecheck
- tests

### `deploy-staging.yml`

Run:
- authenticate to Azure
- `azd provision` or infra validation
- build and deploy backend
- deploy frontend
- run smoke checks

### `deploy-prod.yml`

Run:
- manual approval
- deploy production artifacts
- verify health

## Authentication from GitHub to Azure

Recommended:
- GitHub OIDC / workload identity federation

Fallback:
- service principal with secrets

Why OIDC is better:
- no long-lived Azure secret in GitHub
- cleaner security posture

## What `az` Should Still Be Used For

Even with `azd + Bicep`, keep `az` as the operator tool for:
- inspecting deployed resources
- checking logs
- debugging auth/config issues
- one-off secret updates
- emergency manual rollbacks

Examples of practical use:
- `az containerapp logs show`
- `az containerapp revision list`
- `az postgres flexible-server show`
- `az keyvault secret show`

## Suggested Rollout Plan

### Step 1

Add skeleton files:
- `azure.yaml`
- `infra/azure/main.bicep`
- `infra/azure/modules/*`

### Step 2

Provision only the foundation:
- resource group
- log analytics
- acr
- key vault
- postgres
- container apps environment

### Step 3

Deploy backend through IaC + CI/CD.

### Step 4

Deploy frontend through Static Web Apps workflow.

### Step 5

Add alerts, custom domains, and production hardening.

## Practical Recommendation for This Repo

The best realistic first version is:

- Infra defined in Bicep
- Environment orchestration with `azd`
- Backend deployed to Container Apps
- Frontend deployed to Static Web Apps
- GitHub Actions for staging/prod automation

This gives a strong balance between:
- maintainability
- speed of implementation
- production readiness

## Official References

Official docs used for this recommendation:

- Azure Developer CLI overview:
  - https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview
- Azure Developer CLI commands:
  - https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-commands
- Azure CLI get started:
  - https://learn.microsoft.com/en-us/cli/azure/get-started-with-azure-cli
- Bicep overview:
  - https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview
- GitHub Actions + Azure login:
  - https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect

## Recommended Next Step

The best next concrete artifact to create is:
- a minimal `infra/azure/` Bicep scaffold
- plus `azure.yaml`

After that:
- wire staging deployment in GitHub Actions
