// =============================================================================
// Private DNS zone with a VNet link
// =============================================================================
//
// Generic helper that creates a `privatelink.*` zone and links a single VNet
// to it so private-endpoint hostnames resolve inside the network. Each
// workload that needs a private endpoint (Postgres #566, Key Vault/ACR #586)
// instantiates this module once with the service-specific zone name.
//
// Private DNS zones are global resources — `location` is always `'global'`
// even though the zone lives inside a resource group.
// =============================================================================

@description('Fully-qualified zone name, e.g. `privatelink.postgres.database.azure.com`.')
param zoneName string

@description('Resource ID of the VNet to link to the zone. The link is one-way (zone → VNet) and does not enable auto-registration.')
param vnetId string

@description('Tags applied to the zone.')
param tags object = {}

resource zone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: zoneName
  location: 'global'
  tags: tags
}

// Link name must be unique per (zone, VNet) pair. uniqueString on the VNet id
// keeps it stable across redeploys without exposing the VNet name in the link.
resource vnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  name: 'link-${uniqueString(vnetId)}'
  parent: zone
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    // We rely on Azure Private Endpoint to create A records automatically.
    // Auto-registration would only be needed if VMs in the VNet registered
    // their own hostnames, which isn't our case.
    registrationEnabled: false
  }
}

output zoneId string = zone.id
output zoneName string = zone.name
