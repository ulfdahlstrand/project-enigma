// =============================================================================
// Application Insights (workspace-based)
// =============================================================================
//
// Request traces, dependencies, exceptions and client-side telemetry. Backed
// by a Log Analytics workspace so query and retention are unified with other
// diagnostic data.
//
// The connection string (not the instrumentation key) is the supported
// integration point for the Node.js and browser SDKs — surface it as the
// primary output.
// =============================================================================

@description('Resource name for the App Insights component.')
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Resource ID of the Log Analytics workspace that backs this component.')
param logAnalyticsWorkspaceId string

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output connectionString string = appInsights.properties.ConnectionString
