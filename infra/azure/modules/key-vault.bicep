// =============================================================================
// Azure Key Vault (RBAC mode)
// =============================================================================
//
// Central secret store for Container App, CI, and future workloads. RBAC is
// enabled instead of access policies so permissions follow Azure AD roles
// (auditable and compatible with managed identities).
//
// Soft-delete is always on. Purge protection is enforced in prod only; in
// staging we leave it unset so the vault can be recreated freely during
// infra iteration.
//
// Placeholder secrets (DATABASE_URL, SESSION_SECRET, …) are seeded manually
// via `az keyvault secret set` or in a later feature — this module does not
// create secrets so the template stays idempotent regardless of real values.
//
// When `secretsUserPrincipalId` is supplied, the module grants that principal
// the `Key Vault Secrets User` built-in role (read-only on secrets). Leave
// it empty until the consuming managed identity exists.
//
// Network posture: `publicNetworkAccess` defaults to `Enabled` with an
// `Allow` ACL so developer laptops and CI runners can reach the vault while
// the infra stack is still being stood up. `main.bicep` flips both to
// `Disabled` + `Deny` for prod today; the fully-private posture via
// private endpoints is tracked in #586. Until PE lands, RBAC is the only
// identity gate — keep principal assignments tight.
// =============================================================================

@description('Resource name for the Key Vault. Must be globally unique, 3–24 chars, alphanumeric with dashes.')
@minLength(3)
@maxLength(24)
param name string

@description('Deployment region.')
param location string

@description('Tags applied to the resource.')
param tags object = {}

@description('Pricing tier. Standard is sufficient for most workloads; Premium adds HSM-backed keys.')
@allowed([
  'standard'
  'premium'
])
param skuName string = 'standard'

@description('Days a soft-deleted vault remains recoverable before permanent deletion.')
@minValue(7)
@maxValue(90)
param softDeleteRetentionInDays int = 90

@description('Enable purge protection. Once enabled it cannot be disabled — keep false in staging.')
param enablePurgeProtection bool = false

@description('Principal ID (object ID) of a managed identity to grant `Key Vault Secrets User` role. Leave empty to skip the role assignment.')
param secretsUserPrincipalId string = ''

@description('Whether the vault data plane is reachable from the public internet.')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

@description('Default action for the vault firewall. Use `Deny` together with `virtualNetworkRules` once private endpoints/service endpoints land.')
@allowed([
  'Allow'
  'Deny'
])
param networkAclsDefaultAction string = 'Allow'

// Built-in role definition IDs are stable across tenants.
// `Key Vault Secrets User` — read secret contents and metadata.
var keyVaultSecretsUserRoleId = '4633458b-17de-41a5-8b4b-a57da4b7b2b5'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: skuName
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionInDays
    // `null` in Bicep emits no property — required so staging vaults can be
    // recreated without waiting for the soft-delete window to expire.
    enablePurgeProtection: enablePurgeProtection ? true : null
    publicNetworkAccess: publicNetworkAccess
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: networkAclsDefaultAction
    }
  }
}

resource secretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(secretsUserPrincipalId)) {
  name: guid(vault.id, secretsUserPrincipalId, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    principalId: secretsUserPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

output vaultId string = vault.id
output vaultName string = vault.name
output vaultUri string = vault.properties.vaultUri
