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
// Additional modules (Log Analytics, ACR, Container Apps env, PG, Key Vault,
// SWA, OIDC, observability) are added in subsequent features of epic #560.
// Each module receives `resourceGroupName`, `location`, `tags`, and any
// outputs from earlier modules it depends on.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

output resourceGroupName string = rg.name
output resourceGroupId string = rg.id
output location string = location
output environmentName string = environmentName
