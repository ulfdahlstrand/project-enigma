// =============================================================================
// Container Apps managed environment
// =============================================================================
//
// Shared environment for backend (and future containers). Bound to a Log
// Analytics workspace for unified log ingestion. VNet-integrated via a
// dedicated /23 subnet (Microsoft.App/environments delegation).
//
// Zone redundancy is enabled only in prod to balance availability and cost.
// NOTE: `zoneRedundant` is immutable on Microsoft.App/managedEnvironments —
// flipping it requires deleting and recreating the environment (and every
// container app inside it). Set it deliberately per environment and avoid
// toggling in PRs expecting a hot change.
//
// Workload profile defaults to Consumption, which covers staging and prod
// until a dedicated plan is required.
//
// TODO(#585): switch log ingestion to identity-based auth once a
// user-assigned identity is wired in. Today we pass the Log Analytics
// primary shared key via `listKeys()` — functional, but the key lands in
// deployment state. When we migrate, remove the `logAnalyticsWorkspace`
// existing lookup and flip the workspace's `disableLocalAuth` to true.
// =============================================================================

@description('Resource name for the Container Apps environment.')
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Name of the Log Analytics workspace that backs log ingestion. Passed explicitly so we do not parse the resource ID.')
param logAnalyticsWorkspaceName string

@description('Resource ID of the subnet delegated to Microsoft.App/environments.')
param infrastructureSubnetId string

@description('Enable zone redundancy. Recommended for prod only. Immutable once deployed.')
param zoneRedundant bool = false

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
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
