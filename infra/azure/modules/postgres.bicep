// =============================================================================
// Azure Database for PostgreSQL — Flexible Server (VNet-integrated)
// =============================================================================
//
// Private-access PostgreSQL server reachable only from the delegated subnet.
// No public endpoint. SSL is enforced server-side so clients cannot opt out.
//
// SKU defaults target staging (Burstable B1ms); prod overrides to a
// General Purpose tier so zone-redundant HA is available (Burstable does
// not support HA). Storage grows automatically up to the cap — no manual
// resize needed.
//
// Authentication: password-only for now. Managed identity (Entra) auth is
// tracked separately so we can ship the migration pipeline before the
// identity plumbing is finished.
//
// App-user with minimal privileges on the `cv_tool` database is created by
// the Kysely migrator (#567) — ARM/Bicep has no resource type for PG roles.
// This module only creates the admin login and the empty database.
// =============================================================================

@description('Resource name for the server. 3–63 chars, lowercase, must be globally unique.')
@minLength(3)
@maxLength(63)
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('PostgreSQL major version. 16 matches the local Docker image the app is developed against.')
@allowed(['14', '15', '16'])
param postgresVersion string = '16'

@description('SKU tier. Burstable fits staging; GeneralPurpose/MemoryOptimized unlock zone-redundant HA for prod.')
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'

@description('Compute SKU name. Must be compatible with the selected tier (e.g. Standard_B1ms for Burstable, Standard_D2ds_v5 for GP).')
param skuName string = 'Standard_B1ms'

@description('Storage size in GiB. Autogrow keeps costs predictable until the cap is hit.')
@minValue(32)
@maxValue(16384)
param storageSizeGB int = 32

@description('Backup retention in days. Staging = 7, prod = 35 (PITR max).')
@minValue(7)
@maxValue(35)
param backupRetentionDays int = 7

@description('Enable zone-redundant HA. Only supported on GeneralPurpose/MemoryOptimized tiers.')
param highAvailability bool = false

@description('Resource ID of the subnet delegated to Microsoft.DBforPostgreSQL/flexibleServers.')
param delegatedSubnetId string

@description('Resource ID of the privatelink.postgres.database.azure.com Private DNS zone linked to the VNet.')
param privateDnsZoneId string

@description('Administrator login name. Avoid reserved names like `admin`, `sa`, `postgres`.')
param administratorLogin string = 'cvtooladmin'

@secure()
@description('Administrator password. Must meet PG Flex complexity: ≥8 chars, 3 of 4 classes. Seed via azd env-var; written to Key Vault after deploy.')
param administratorPassword string

@description('Initial database to create on the server. App-user + privileges are granted by the migration pipeline (#567).')
param databaseName string = 'cv_tool'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: delegatedSubnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      // publicNetworkAccess is implicit for VNet-integrated servers — the
      // API rejects setting it explicitly when delegatedSubnetResourceId
      // is present. The server is only reachable from the VNet.
    }
    highAvailability: {
      mode: highAvailability ? 'ZoneRedundant' : 'Disabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      // TODO(#585): flip to ActiveDirectoryAuth once the Container App has
      // a managed identity and we can drop the password secret entirely.
      activeDirectoryAuth: 'Disabled'
    }
  }
}

// Force SSL for every connection. Clients without `sslmode=require` are
// rejected at the server before authentication.
resource requireSecureTransport 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  name: 'require_secure_transport'
  parent: postgres
  properties: {
    value: 'on'
    source: 'user-override'
  }
}

resource cvToolDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  name: databaseName
  parent: postgres
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output serverId string = postgres.id
output serverName string = postgres.name
output fqdn string = postgres.properties.fullyQualifiedDomainName
output databaseName string = cvToolDatabase.name
output administratorLogin string = administratorLogin
