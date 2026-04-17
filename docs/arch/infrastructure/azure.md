# Azure Deployment

> Sub-document of [infrastructure/index.md](./index.md).
>
> Epic: [#560 — Automatiserad Azure-deploy med Bicep + azd + GitHub Actions](https://github.com/ulfdahlstrand/project-enigma/issues/560)

This document describes how the application is provisioned and deployed to
Azure. It is a live runbook — each feature in epic #560 adds sections as the
infrastructure is built out.

## Target architecture

| Layer | Azure service |
|-------|---------------|
| Frontend (Vite SPA) | Azure Static Web Apps |
| Backend (Node.js oRPC) | Azure Container Apps |
| Database | Azure Database for PostgreSQL Flexible Server |
| Image registry | Azure Container Registry (ACR) |
| Secrets | Azure Key Vault + managed identity |
| Logs / metrics | Log Analytics + Application Insights |
| Automation | Bicep (infra) · `azd` (orchestration) · GitHub Actions (CI/CD) |

## Repository layout

```
infra/azure/
├── main.bicep                    # Subscription-scope entry point
├── main.parameters.staging.json  # Per-env parameter values
├── main.parameters.prod.json
└── modules/                      # One Bicep module per resource family
azure.yaml                        # Azure Developer CLI (azd) config
```

## Prerequisites

Install the required CLIs locally before working on this infrastructure:

```bash
# macOS (homebrew)
brew update
brew install azure-cli
az bicep install                  # installs bicep via az
brew tap azure/azd && brew install azd
```

Verify:

```bash
az --version
az bicep version
azd version
```

## Environments

Two `azd` environments are used:

| Environment | Purpose | Azure subscription / RG |
|-------------|---------|-------------------------|
| `staging` | Continuous deploy from `dev` branch | `rg-cvtool-staging` |
| `prod` | Manual promotion (tag on `main`) | `rg-cvtool-prod` |

Switching between them:

```bash
azd env select staging     # or prod
azd env list
```

## First-time bootstrap (local)

1. Log in to Azure:
   ```bash
   az login
   azd auth login
   ```
2. Create the environment:
   ```bash
   azd env new staging
   ```
3. Provision the resource group (only step available until the next features
   land):
   ```bash
   azd provision
   ```

## Entra ID — redirect URIs for staging and prod

The app already uses **Microsoft Entra ID** for authentication. Before staging
or prod becomes reachable on its public domain, add the corresponding redirect
URIs to the **existing Entra app registration** (no code change needed):

1. Open `Microsoft Entra admin center → App registrations → <project app>`.
2. Go to `Authentication → Add a platform → Single-page application`.
3. Add redirect URIs for each environment, e.g.:
   - `https://<staging-hostname>/`
   - `https://<staging-hostname>/login`
   - `https://<prod-hostname>/`
   - `https://<prod-hostname>/login`
4. Save.

## Bicep module conventions

Each module in `infra/azure/modules/` follows the same shape:

- Accepts `location`, `tags`, and any dependency IDs as parameters.
- Exposes only the outputs the next module needs.
- Named after the resource family it manages (`log-analytics.bicep`,
  `acr.bicep`, `container-apps-env.bicep`, …).

Adding a new module:

1. Create `infra/azure/modules/<name>.bicep`.
2. Consume it from `main.bicep` inside the resource group scope.
3. Pass through common parameters (`location`, `tags`).
4. Wire outputs into later modules.

## CI/CD

GitHub Actions workflows are added by features #574–#576. Authentication uses
OIDC federated credentials configured in #573 — there are no long-lived Azure
secrets in GitHub.

## Related features

Follow the progress in the epic body ([#560](https://github.com/ulfdahlstrand/project-enigma/issues/560)).
