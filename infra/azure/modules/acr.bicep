// =============================================================================
// Azure Container Registry (ACR)
// =============================================================================
//
// Private registry for backend container images. Container App pulls via
// managed identity — admin user is disabled so credentials never leave the
// control plane.
//
// Staging defaults to Basic (cheapest, single replica); prod uses Standard
// for larger storage quota and retention-policy support. Retention policies
// require Standard or Premium SKU, so the policy block is only emitted when
// the SKU permits it.
// =============================================================================

@description('Resource name for the registry. ACR names are alphanumeric, 5–50 chars, globally unique.')
@minLength(5)
@maxLength(50)
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Pricing tier. Basic is sufficient for staging; Standard/Premium enable geo-replication and retention policies.')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param sku string = 'Basic'

@description('Days before untagged manifests are eligible for cleanup. Requires Standard or Premium SKU.')
@minValue(0)
@maxValue(365)
param untaggedRetentionDays int = 7

var retentionPolicySupported = sku != 'Basic'

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: retentionPolicySupported ? {
      retentionPolicy: {
        status: 'enabled'
        days: untaggedRetentionDays
      }
    } : {}
  }
}

output registryId string = registry.id
output registryName string = registry.name
output loginServer string = registry.properties.loginServer
