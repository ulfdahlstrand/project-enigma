// =============================================================================
// Log Analytics workspace
// =============================================================================
//
// Shared sink for every diagnostic setting in the environment plus the backing
// store for Application Insights. Provisioned first so later modules can
// reference `workspaceId` as a dependency.
// =============================================================================

@description('Resource name for the workspace.')
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Pricing tier. PerGB2018 is the modern default — pay for data ingested.')
@allowed([
  'PerGB2018'
  'CapacityReservation'
])
param sku string = 'PerGB2018'

@description('Retention (days) for ingested logs. 30 is the free minimum; bump for prod.')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: sku
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = workspace.id
output workspaceName string = workspace.name
output customerId string = workspace.properties.customerId
