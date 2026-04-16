// =============================================================================
// Key Vault secret helper
// =============================================================================
//
// Writes a single secret into an existing Key Vault. Separate from the
// key-vault.bicep module so secrets can be created after the resources whose
// values they hold (e.g. Postgres admin password, connection strings) — the
// vault itself is provisioned once, secrets are appended as dependent
// resources come online.
//
// Callers are responsible for ensuring the deploying principal has the
// `Key Vault Secrets Officer` (or higher) RBAC role on the vault. azd +
// developer/CI principals already have this on our setup; Container App
// identity consumes secrets via `Key Vault Secrets User` granted elsewhere.
// =============================================================================

@description('Name of the existing Key Vault. Not the full resource ID.')
param keyVaultName string

@description('Secret name. Kebab-case by convention (e.g. postgres-admin-password).')
param secretName string

@secure()
@description('Secret value. Never logged by ARM.')
param secretValue string

@description('Optional content-type hint (e.g. `text/plain`, `application/x-postgresql-connection-string`).')
param contentType string = ''

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: secretName
  parent: vault
  properties: {
    value: secretValue
    contentType: empty(contentType) ? null : contentType
  }
}

output secretId string = secret.id
output secretName string = secret.name
output secretUriWithVersion string = secret.properties.secretUriWithVersion
