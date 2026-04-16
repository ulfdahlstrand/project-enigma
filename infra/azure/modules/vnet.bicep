// =============================================================================
// Virtual Network with application subnets
// =============================================================================
//
// Provisions a single VNet carved up for every workload planned in epic
// #560. Adding more subnets requires editing the VNet in place, so we
// reserve the address ranges now even though only Container Apps uses its
// subnet today. Reserving up-front avoids painful re-planning when the PG
// (#566) and private-endpoint (#560 follow-up) features land.
//
// Default address plan inside 10.0.0.0/16:
//   - 10.0.0.0/23   → Container Apps  (Microsoft.App/environments)
//   - 10.0.2.0/24   → PostgreSQL Flex (Microsoft.DBforPostgreSQL/flexibleServers)
//   - 10.0.3.0/27   → Private endpoints
//   - 10.0.4.0/27   → Reserved (future — bastion, jumpbox, etc.)
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

@description('Name for the PostgreSQL Flex subnet.')
param postgresSubnetName string = 'snet-postgres'

@description('CIDR for the PostgreSQL Flex subnet. Delegated to Microsoft.DBforPostgreSQL/flexibleServers.')
param postgresSubnetPrefix string = '10.0.2.0/24'

@description('Name for the private endpoint subnet.')
param privateEndpointSubnetName string = 'snet-pe'

@description('CIDR for the private endpoint subnet.')
param privateEndpointSubnetPrefix string = '10.0.3.0/27'

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
      {
        name: postgresSubnetName
        properties: {
          addressPrefix: postgresSubnetPrefix
          delegations: [
            {
              name: 'Microsoft.DBforPostgreSQL-flexibleServers'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
// Preserve the Container Apps subnet as the default-named output so existing
// consumers keep working; name-addressed outputs expose the other subnets.
output subnetId string = vnet.properties.subnets[0].id
output subnetName string = vnet.properties.subnets[0].name
output containerAppsSubnetId string = vnet.properties.subnets[0].id
output postgresSubnetId string = vnet.properties.subnets[1].id
output privateEndpointSubnetId string = vnet.properties.subnets[2].id
