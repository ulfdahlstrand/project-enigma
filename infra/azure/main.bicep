// =============================================================================
// CV Tool — Azure infrastructure root template
// =============================================================================
//
// Deploys a resource group for the selected environment and (later) composes
// all infrastructure modules from `./modules/`. Modules are added incrementally
// as features from epic #560 land.
//
// Deploy locally:
//   az login
//   az deployment sub create \
//     --location <region> \
//     --template-file infra/azure/main.bicep \
//     --parameters infra/azure/main.parameters.<env>.json
//
// Or via Azure Developer CLI (preferred):
//   azd env select <env>
//   azd provision
// =============================================================================

targetScope = 'subscription'

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

// Only parameters that require per-environment overrides are exposed here;
// everything else is configured via module defaults so main.bicep stays a
// thin composition layer. See #588.

@description('Environment identifier. Drives resource naming and per-env ternaries below.')
@allowed(['staging', 'prod'])
param environmentName string

@description('Primary Azure region for all resources.')
param location string

@description('Short project code used as a prefix in resource names.')
param projectCode string = 'cvtool'

@description('Resource group name. Defaults to rg-<projectCode>-<environmentName>.')
param resourceGroupName string = 'rg-${projectCode}-${environmentName}'

@description('Common tags applied to every resource.')
param tags object = { environment: environmentName, project: projectCode, managedBy: 'bicep' }

@description('Retention (days) for ingested Log Analytics data. Staging = 30, prod = 90.')
@minValue(30)
@maxValue(730)
param logAnalyticsRetentionInDays int = 30

@description('SKU for Key Vault. Staging = standard, prod = premium (HSM-backed).')
@allowed(['standard', 'premium'])
param keyVaultSkuName string = 'standard'

@description('Days a soft-deleted Key Vault remains recoverable. Staging = 7, prod = 90.')
@minValue(7)
@maxValue(90)
param keyVaultSoftDeleteRetentionInDays int = 7

@secure()
@description('PostgreSQL administrator password. Seed via `azd env set POSTGRES_ADMIN_PASSWORD`; the Bicep run writes it to Key Vault after the server is provisioned so the Container App can consume it via secret reference. Must satisfy PG Flex complexity: ≥8 chars, 3 of 4 character classes.')
param postgresAdminPassword string

// -----------------------------------------------------------------------------
// Resource group (the one resource that lives above every module)
// -----------------------------------------------------------------------------

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// -----------------------------------------------------------------------------
// Modules
// -----------------------------------------------------------------------------
// Additional modules (ACR, Container Apps env, PG, Key Vault, SWA, OIDC) are
// added in subsequent features of epic #560. Each module receives `location`,
// `tags`, and any outputs from earlier modules it depends on.
// -----------------------------------------------------------------------------

module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics'
  scope: rg
  params: {
    name: 'log-${projectCode}-${environmentName}'
    location: location
    tags: tags
    retentionInDays: logAnalyticsRetentionInDays
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: 'app-insights'
  scope: rg
  params: {
    name: 'appi-${projectCode}-${environmentName}'
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  scope: rg
  params: {
    // ACR names are globally unique, alphanumeric only (no dashes), ≤50 chars.
    // The uniqueString suffix avoids collisions with other tenants deploying
    // this template. 6 chars is enough entropy while keeping the final name
    // short enough to read in the portal.
    name: 'acr${projectCode}${environmentName}${substring(uniqueString(subscription().id, resourceGroupName), 0, 6)}'
    location: location
    tags: tags
    // Prod gets Standard for the larger storage quota and retention-policy
    // support; staging stays on Basic to keep cost down. acrUntaggedRetention
    // follows the module default (7 days) — no per-env override needed yet.
    sku: environmentName == 'prod' ? 'Standard' : 'Basic'
    // Prod runs with the data plane closed to the internet — pulls happen
    // over the Container Apps VNet via private endpoint (see #586). Staging
    // stays Enabled so developer laptops and CI can push/pull directly
    // until the PE wiring lands.
    publicNetworkAccess: environmentName == 'prod' ? 'Disabled' : 'Enabled'
  }
}

module vnet 'modules/vnet.bicep' = {
  name: 'vnet'
  scope: rg
  params: {
    name: 'vnet-${projectCode}-${environmentName}'
    location: location
    tags: tags
    containerAppsSubnetName: 'snet-cae-${environmentName}'
  }
}

module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'container-apps-env'
  scope: rg
  params: {
    name: 'cae-${projectCode}-${environmentName}'
    location: location
    tags: tags
    logAnalyticsWorkspaceName: logAnalytics.outputs.workspaceName
    infrastructureSubnetId: vnet.outputs.containerAppsSubnetId
    zoneRedundant: environmentName == 'prod'
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault'
  scope: rg
  params: {
    // Key Vault names are globally unique. A 4-char hash keeps the overall
    // length ≤24 and avoids collisions when the RG is redeployed.
    name: 'kv-${projectCode}-${environmentName}-${substring(uniqueString(subscription().id, resourceGroupName), 0, 4)}'
    location: location
    tags: tags
    skuName: keyVaultSkuName
    softDeleteRetentionInDays: keyVaultSoftDeleteRetentionInDays
    enablePurgeProtection: environmentName == 'prod'
    // Populated in a later feature once the Container App managed identity exists.
    secretsUserPrincipalId: ''
    // Prod closes the vault data plane to the internet and flips the firewall
    // default to Deny — secrets are only reachable from the VNet-integrated
    // Container App via private endpoint (tracked in #586). Staging stays
    // open + Allow so developers and CI can seed placeholder secrets during
    // infra iteration. RBAC remains the identity gate in both environments.
    publicNetworkAccess: environmentName == 'prod' ? 'Disabled' : 'Enabled'
    networkAclsDefaultAction: environmentName == 'prod' ? 'Deny' : 'Allow'
  }
}

module postgresPrivateDns 'modules/private-dns-zone.bicep' = {
  name: 'postgres-private-dns'
  scope: rg
  params: {
    zoneName: 'privatelink.postgres.database.azure.com'
    vnetId: vnet.outputs.vnetId
    tags: tags
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  scope: rg
  params: {
    // PG Flex names are globally unique. A 4-char hash avoids collisions on
    // redeploy; the `pg-` prefix + env suffix keeps it readable in the portal.
    name: 'pg-${projectCode}-${environmentName}-${substring(uniqueString(subscription().id, resourceGroupName), 0, 4)}'
    location: location
    tags: tags
    // Burstable is cheap and adequate for staging; GeneralPurpose unlocks
    // zone-redundant HA in prod. Compute SKU must match the tier — Standard_B1ms
    // for Burstable, Standard_D2ds_v5 for GP (the smallest GP SKU).
    skuTier: environmentName == 'prod' ? 'GeneralPurpose' : 'Burstable'
    skuName: environmentName == 'prod' ? 'Standard_D2ds_v5' : 'Standard_B1ms'
    // 7 days for staging (default), 35 for prod (PITR maximum).
    backupRetentionDays: environmentName == 'prod' ? 35 : 7
    // HA requires GeneralPurpose/MemoryOptimized — enabled only in prod.
    highAvailability: environmentName == 'prod'
    delegatedSubnetId: vnet.outputs.postgresSubnetId
    privateDnsZoneId: postgresPrivateDns.outputs.zoneId
    administratorPassword: postgresAdminPassword
  }
}

module postgresAdminPasswordSecret 'modules/key-vault-secret.bicep' = {
  name: 'secret-postgres-admin-password'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.vaultName
    secretName: 'postgres-admin-password'
    secretValue: postgresAdminPassword
    contentType: 'text/plain'
  }
}

module postgresConnectionStringSecret 'modules/key-vault-secret.bicep' = {
  name: 'secret-postgres-connection-string'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.vaultName
    secretName: 'postgres-connection-string'
    // URL-encoded? Password policy already disallows `@`, `/`, `:`, `?`, so
    // raw concatenation is safe. sslmode=require matches server-side
    // require_secure_transport enforced in modules/postgres.bicep.
    secretValue: 'postgresql://${postgres.outputs.administratorLogin}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}?sslmode=require'
    contentType: 'application/x-postgresql-connection-string'
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

output resourceGroupName string = rg.name
output resourceGroupId string = rg.id
output location string = location
output environmentName string = environmentName
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
output logAnalyticsWorkspaceName string = logAnalytics.outputs.workspaceName
output appInsightsConnectionString string = appInsights.outputs.connectionString
output acrLoginServer string = acr.outputs.loginServer
output acrId string = acr.outputs.registryId
output containerAppsEnvironmentId string = containerAppsEnv.outputs.environmentId
output containerAppsDefaultDomain string = containerAppsEnv.outputs.defaultDomain
output keyVaultUri string = keyVault.outputs.vaultUri
output keyVaultName string = keyVault.outputs.vaultName
output postgresServerFqdn string = postgres.outputs.fqdn
output postgresDatabaseName string = postgres.outputs.databaseName
// URIs (not values) of the KV secrets — safe to output. The Container App
// (later feature) consumes these via `keyvaultref:` secret references.
output postgresAdminPasswordSecretUri string = postgresAdminPasswordSecret.outputs.secretUriWithVersion
output postgresConnectionStringSecretUri string = postgresConnectionStringSecret.outputs.secretUriWithVersion
