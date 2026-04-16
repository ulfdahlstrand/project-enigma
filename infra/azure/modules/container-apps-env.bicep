// =============================================================================
// Container Apps managed environment
// =============================================================================
//
// Shared environment for backend (and future containers). Bound to a Log
// Analytics workspace for unified log ingestion. VNet-integrated via a
// dedicated /23 subnet (Microsoft.App/environments delegation).
//
// Zone redundancy is enabled only in prod to balance availability and cost.
// Workload profile defaults to Consumption, which covers staging and prod
// until a dedicated plan is required.
// =============================================================================

@description('Resource name for the Container Apps environment.')
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Resource ID of the Log Analytics workspace for log ingestion.')
param logAnalyticsWorkspaceId string

@description('Resource ID of the subnet delegated to Microsoft.App/environments.')
param infrastructureSubnetId string

@description('Enable zone redundancy. Recommended for prod only.')
param zoneRedundant bool = false

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    zoneRedundant: zoneRedundant
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

output environmentId string = containerAppsEnv.id
output environmentName string = containerAppsEnv.name
output defaultDomain string = containerAppsEnv.properties.defaultDomain
output staticIp string = containerAppsEnv.properties.staticIp
