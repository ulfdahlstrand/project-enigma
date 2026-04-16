// =============================================================================
// Virtual Network with Container Apps subnet
// =============================================================================
//
// Provisions a VNet with a dedicated /23 subnet for Container Apps environments.
// The subnet is delegated to Microsoft.App/environments, which is required for
// VNet-integrated Container Apps environments.
//
// VNet-integration prepares private endpoint connectivity to PostgreSQL and
// Key Vault in later features.
// =============================================================================

@description('Resource name for the VNet.')
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Address space for the VNet (e.g. 10.0.0.0/16).')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Name for the Container Apps subnet.')
param containerAppsSubnetName string

@description('CIDR for the Container Apps subnet. Must be /23 or larger for dedicated Container Apps environments.')
param containerAppsSubnetPrefix string = '10.0.0.0/23'

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: containerAppsSubnetName
        properties: {
          addressPrefix: containerAppsSubnetPrefix
          delegations: [
            {
              name: 'Microsoft.App-environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output subnetId string = vnet.properties.subnets[0].id
output subnetName string = vnet.properties.subnets[0].name
