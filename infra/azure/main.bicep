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

@description('Environment identifier (e.g. staging, prod). Used in resource names and tags.')
@allowed([
  'staging'
  'prod'
])
param environmentName string

@description('Primary Azure region for all resources.')
param location string

@description('Short project code used as a prefix in resource names.')
param projectCode string = 'cvtool'

@description('Resource group name. Defaults to rg-<projectCode>-<environmentName>.')
param resourceGroupName string = 'rg-${projectCode}-${environmentName}'

@description('Common tags applied to every resource.')
param tags object = {
  environment: environmentName
  project: projectCode
  managedBy: 'bicep'
}

@description('Retention (days) for ingested Log Analytics data. Tune per environment.')
@minValue(30)
@maxValue(730)
param logAnalyticsRetentionInDays int = 30

@description('SKU for Azure Container Registry. Basic is the cheapest; Standard/Premium enable retention policies.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param acrSku string = environmentName == 'prod' ? 'Standard' : 'Basic'

@description('Days before untagged ACR manifests are eligible for cleanup. Only enforced on Standard/Premium SKUs.')
@minValue(0)
@maxValue(365)
param acrUntaggedRetentionDays int = 7

@description('SKU for Key Vault. Standard is typical; Premium adds HSM-backed keys.')
@allowed([
  'standard'
  'premium'
])
param keyVaultSkuName string = 'standard'

@description('Days a soft-deleted Key Vault remains recoverable. Longer in prod for audit/recovery windows.')
@minValue(7)
@maxValue(90)
param keyVaultSoftDeleteRetentionInDays int = 7

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
    // ACR names are alphanumeric only (no dashes). Keep ≤50 chars.
    name: 'acr${projectCode}${environmentName}'
    location: location
    tags: tags
    sku: acrSku
    untaggedRetentionDays: acrUntaggedRetentionDays
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
    infrastructureSubnetId: vnet.outputs.subnetId
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
