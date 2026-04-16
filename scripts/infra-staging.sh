#!/usr/bin/env bash
# =============================================================================
# infra-staging.sh — provision / verify / test the Azure staging infra (#560)
#
# Subcommands (run from repo root):
#   validate       Dry run. `az deployment sub what-if` shows what would change.
#   provision      Actual deploy via `azd provision`. Creates RG + all resources.
#   verify         Post-deploy checks: KV secrets exist, PG is VNet-only, outputs.
#   test-connect   Spin up a temp Ubuntu VM in the VNet, run psql over SSL,
#                  then delete the VM. Exits non-zero if plaintext works.
#   down           Tear down the entire staging RG. Interactive confirm.
#
# Usage:
#   ./scripts/infra-staging.sh validate
#   ./scripts/infra-staging.sh provision
#   ./scripts/infra-staging.sh verify
#   ./scripts/infra-staging.sh test-connect
#   ./scripts/infra-staging.sh down
#
# Prerequisites:
#   - az CLI logged in to the staging subscription
#   - azd CLI (https://aka.ms/azd) with a 'staging' environment
#   - openssl (for generating POSTGRES_ADMIN_PASSWORD if not set)
#   - bash 4+
#
# Environment variables (optional):
#   POSTGRES_ADMIN_PASSWORD  Set to reuse an existing password; otherwise one
#                            is generated once and written to azd env.
#   AZD_ENV                  azd environment name. Default: staging.
#   RG_NAME                  Resource group name. Default: rg-cvtool-staging.
#   LOCATION                 Azure region. Default: swedencentral.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AZD_ENV="${AZD_ENV:-staging}"
RG_NAME="${RG_NAME:-rg-cvtool-staging}"
LOCATION="${LOCATION:-swedencentral}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/infra/azure/main.bicep"
PARAMS="${REPO_ROOT}/infra/azure/main.parameters.staging.json"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
# shellcheck disable=SC2034
RED=$'\033[0;31m' GREEN=$'\033[0;32m' YELLOW=$'\033[1;33m' BLUE=$'\033[0;34m' BOLD=$'\033[1m' RESET=$'\033[0m'

log()   { printf '%s[infra-staging]%s %s\n' "${BLUE}" "${RESET}" "$*"; }
step()  { printf '\n%s▶ %s%s\n' "${BOLD}" "$*" "${RESET}"; }
pass()  { printf '%s✅ %s%s\n' "${GREEN}" "$*" "${RESET}"; }
warn()  { printf '%s⚠ %s%s\n' "${YELLOW}" "$*" "${RESET}" >&2; }
fail()  { printf '%s❌ %s%s\n' "${RED}" "$*" "${RESET}" >&2; exit 1; }

confirm() {
  # confirm <prompt> — returns 0 if user types 'y' or 'yes'
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "${reply,,}" == "y" || "${reply,,}" == "yes" ]]
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

# ---------------------------------------------------------------------------
# Prereq checks
# ---------------------------------------------------------------------------
check_prereqs() {
  require_cmd az
  require_cmd azd
  require_cmd openssl
  az account show >/dev/null 2>&1 || fail "az is not logged in. Run: az login"
  [[ -f "${TEMPLATE}" ]] || fail "Template not found: ${TEMPLATE}"
  [[ -f "${PARAMS}" ]]   || fail "Parameter file not found: ${PARAMS}"
}

# ---------------------------------------------------------------------------
# Password handling — reuse env or azd-stored, generate once otherwise
# ---------------------------------------------------------------------------
ensure_password() {
  if [[ -n "${POSTGRES_ADMIN_PASSWORD:-}" ]]; then
    log "Using POSTGRES_ADMIN_PASSWORD from environment."
    return
  fi
  # Try azd env first
  if azd env select "${AZD_ENV}" >/dev/null 2>&1; then
    local stored
    stored="$(azd env get-value POSTGRES_ADMIN_PASSWORD 2>/dev/null || true)"
    if [[ -n "${stored}" ]]; then
      export POSTGRES_ADMIN_PASSWORD="${stored}"
      log "Using POSTGRES_ADMIN_PASSWORD from azd env '${AZD_ENV}'."
      return
    fi
  fi
  # Generate — 20 chars, no special chars that break connection strings
  local generated
  generated="$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)"
  export POSTGRES_ADMIN_PASSWORD="${generated}"
  warn "Generated new POSTGRES_ADMIN_PASSWORD: ${generated}"
  warn "Save this somewhere safe — it is now in your shell history."
  if azd env select "${AZD_ENV}" >/dev/null 2>&1; then
    azd env set POSTGRES_ADMIN_PASSWORD "${generated}"
    log "Stored in azd env '${AZD_ENV}'."
  fi
}

# ---------------------------------------------------------------------------
# Subcommand: validate — what-if, no changes
# ---------------------------------------------------------------------------
cmd_validate() {
  check_prereqs
  ensure_password
  step "Running what-if against subscription (no changes)…"
  az deployment sub what-if \
    --location "${LOCATION}" \
    --template-file "${TEMPLATE}" \
    --parameters "${PARAMS}" \
    --parameters "postgresAdminPassword=${POSTGRES_ADMIN_PASSWORD}"
  pass "What-if complete. Review the output above before running 'provision'."
}

# ---------------------------------------------------------------------------
# Subcommand: provision — actual deploy
# ---------------------------------------------------------------------------
cmd_provision() {
  check_prereqs
  ensure_password
  step "About to deploy infra to subscription '$(az account show --query name -o tsv)' (env: ${AZD_ENV})"
  confirm "Proceed with azd provision?" || { log "Cancelled."; exit 0; }
  azd env select "${AZD_ENV}" >/dev/null 2>&1 || azd env new "${AZD_ENV}" --location "${LOCATION}"
  azd env set AZURE_LOCATION "${LOCATION}"
  azd provision --environment "${AZD_ENV}"
  pass "Provision complete. Run './scripts/infra-staging.sh verify' next."
}

# ---------------------------------------------------------------------------
# Subcommand: verify — read back what's live
# ---------------------------------------------------------------------------
cmd_verify() {
  check_prereqs
  step "Resource group"
  az group show --name "${RG_NAME}" --query '{name:name, location:location, state:properties.provisioningState}' -o table

  step "Postgres Flexible Server"
  local pg_name
  pg_name="$(az postgres flexible-server list --resource-group "${RG_NAME}" --query '[0].name' -o tsv)"
  [[ -n "${pg_name}" ]] || fail "No Postgres Flex server found in ${RG_NAME}"
  az postgres flexible-server show --name "${pg_name}" --resource-group "${RG_NAME}" \
    --query '{name:name, state:state, version:version, sslEnforcement:sslEnforcement, publicNetwork:network.publicNetworkAccess, delegatedSubnet:network.delegatedSubnetResourceId, fqdn:fullyQualifiedDomainName, haMode:highAvailability.mode, backupDays:backup.backupRetentionDays}' \
    -o yaml
  pass "Postgres FQDN captured: $(az postgres flexible-server show --name "${pg_name}" --resource-group "${RG_NAME}" --query fullyQualifiedDomainName -o tsv)"

  step "Key Vault secrets"
  local kv_name
  kv_name="$(az keyvault list --resource-group "${RG_NAME}" --query '[0].name' -o tsv)"
  [[ -n "${kv_name}" ]] || fail "No Key Vault found in ${RG_NAME}"
  local secrets
  secrets="$(az keyvault secret list --vault-name "${kv_name}" --query '[].name' -o tsv)"
  echo "${secrets}"
  grep -q '^postgres-admin-password$'     <<< "${secrets}" || fail "Missing secret: postgres-admin-password"
  grep -q '^postgres-connection-string$'  <<< "${secrets}" || fail "Missing secret: postgres-connection-string"
  pass "Both expected secrets present in ${kv_name}."

  step "Private DNS zone"
  az network private-dns zone list --resource-group "${RG_NAME}" --query '[].{name:name, vnetLinks:numberOfVirtualNetworkLinks}' -o table

  step "Deployment outputs"
  azd env get-values 2>/dev/null | grep -Ei '^(postgres|keyvault|acr|container)' || warn "azd env has no deployment outputs; try 'azd provision' first."
}

# ---------------------------------------------------------------------------
# Subcommand: test-connect — spin up VM, test SSL+plaintext, tear down
# ---------------------------------------------------------------------------
cmd_test_connect() {
  check_prereqs
  ensure_password
  local vm_name="pg-tester-$$"
  local pg_name pg_fqdn vnet_name
  pg_name="$(az postgres flexible-server list --resource-group "${RG_NAME}" --query '[0].name' -o tsv)"
  pg_fqdn="$(az postgres flexible-server show --name "${pg_name}" --resource-group "${RG_NAME}" --query fullyQualifiedDomainName -o tsv)"
  vnet_name="$(az network vnet list --resource-group "${RG_NAME}" --query '[0].name' -o tsv)"

  step "Creating temp VM '${vm_name}' in ${vnet_name}/snet-cae-staging…"
  az vm create \
    --resource-group "${RG_NAME}" \
    --name "${vm_name}" \
    --image Ubuntu2204 \
    --size Standard_B1s \
    --vnet-name "${vnet_name}" \
    --subnet snet-cae-staging \
    --admin-username azureuser \
    --generate-ssh-keys \
    --public-ip-sku Standard \
    --nsg-rule SSH \
    --output none

  # Cleanup trap — always remove the VM + its artefacts
  cleanup_vm() {
    warn "Cleaning up test VM '${vm_name}'…"
    az vm delete --resource-group "${RG_NAME}" --name "${vm_name}" --yes --no-wait || true
    az network nic delete --resource-group "${RG_NAME}" --name "${vm_name}VMNic" --no-wait 2>/dev/null || true
    az network public-ip delete --resource-group "${RG_NAME}" --name "${vm_name}PublicIP" --no-wait 2>/dev/null || true
    az network nsg delete --resource-group "${RG_NAME}" --name "${vm_name}NSG" --no-wait 2>/dev/null || true
    az disk list --resource-group "${RG_NAME}" --query "[?starts_with(name,'${vm_name}')].id" -o tsv \
      | xargs -r -I{} az disk delete --ids {} --no-wait --yes 2>/dev/null || true
  }
  trap cleanup_vm EXIT

  step "Installing postgresql-client on VM…"
  az vm run-command invoke \
    --resource-group "${RG_NAME}" --name "${vm_name}" \
    --command-id RunShellScript \
    --scripts "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client" \
    --output none

  step "Test 1/2 — SSL connection (should succeed)"
  local out
  out="$(az vm run-command invoke \
    --resource-group "${RG_NAME}" --name "${vm_name}" \
    --command-id RunShellScript \
    --scripts "PGPASSWORD='${POSTGRES_ADMIN_PASSWORD}' psql 'postgresql://cvtooladmin@${pg_fqdn}:5432/cv_tool?sslmode=require' -tAc 'SELECT version();' 2>&1" \
    --query 'value[0].message' -o tsv)"
  echo "${out}"
  grep -qi 'PostgreSQL' <<< "${out}" && pass "SSL connection works — server replied with version." \
                                     || fail "SSL connection did not return a PG version banner."

  step "Test 2/2 — Plaintext connection (should be rejected)"
  out="$(az vm run-command invoke \
    --resource-group "${RG_NAME}" --name "${vm_name}" \
    --command-id RunShellScript \
    --scripts "PGPASSWORD='${POSTGRES_ADMIN_PASSWORD}' psql 'postgresql://cvtooladmin@${pg_fqdn}:5432/cv_tool?sslmode=disable' -tAc 'SELECT 1;' 2>&1" \
    --query 'value[0].message' -o tsv || true)"
  echo "${out}"
  if grep -qiE 'SSL|secure|encryption|require_secure_transport' <<< "${out}"; then
    pass "Plaintext was rejected — require_secure_transport is enforced."
  else
    fail "Plaintext connection was NOT rejected. SSL enforcement is broken!"
  fi
}

# ---------------------------------------------------------------------------
# Subcommand: down — tear down the staging RG
# ---------------------------------------------------------------------------
cmd_down() {
  check_prereqs
  warn "This will DELETE the entire resource group '${RG_NAME}' in subscription '$(az account show --query name -o tsv)'."
  confirm "Type 'y' to proceed" || { log "Cancelled."; exit 0; }
  # azd down handles soft-delete/purge nicely, fall back to raw az if azd env is missing
  if azd env select "${AZD_ENV}" >/dev/null 2>&1; then
    azd down --environment "${AZD_ENV}" --force --purge
  else
    az group delete --name "${RG_NAME}" --yes --no-wait
    log "Deletion running in background. Track with: az group show --name ${RG_NAME}"
  fi
  pass "Teardown started."
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]}"
  exit 1
}

main() {
  [[ $# -ge 1 ]] || usage
  local cmd="$1"; shift || true
  case "${cmd}" in
    validate)      cmd_validate      "$@" ;;
    provision)     cmd_provision     "$@" ;;
    verify)        cmd_verify        "$@" ;;
    test-connect)  cmd_test_connect  "$@" ;;
    down)          cmd_down          "$@" ;;
    -h|--help|help) usage ;;
    *) fail "Unknown subcommand: ${cmd}. Run '$0 help' for usage." ;;
  esac
}

main "$@"
