#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CLIENT_KEY="${CLIENT_KEY:-anthropic_claude}"
AUTH_TITLE="${AUTH_TITLE:-Claude external AI test}"
APP_ACCESS_TOKEN="${APP_ACCESS_TOKEN:-}"
TEST_LOGIN_PAYLOAD="${TEST_LOGIN_PAYLOAD:-{\"role\":\"admin\"}}"
REQUESTED_SCOPES_JSON="${REQUESTED_SCOPES_JSON:-[\"ai:context:read\"]}"
EXPECT_BLOCKED_ROUTE="${EXPECT_BLOCKED_ROUTE:-/auth/session}"
EXPECT_ALLOWED_ROUTE="${EXPECT_ALLOWED_ROUTE:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

json_post() {
  local url="$1"
  local token="$2"
  local body="$3"
  curl -sS \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    --data "$body" \
    "${BASE_URL}${url}"
}

json_post_no_auth() {
  local url="$1"
  local body="$2"
  curl -sS \
    -X POST \
    -H "Content-Type: application/json" \
    --data "$body" \
    "${BASE_URL}${url}"
}

json_get() {
  local url="$1"
  local token="$2"
  curl -sS \
    -H "Authorization: Bearer ${token}" \
    "${BASE_URL}${url}"
}

echo "== External AI Step 1 flow =="
echo "Base URL: ${BASE_URL}"
echo "Client key: ${CLIENT_KEY}"
echo "Requested scopes: ${REQUESTED_SCOPES_JSON}"

if [[ -z "${APP_ACCESS_TOKEN}" ]]; then
  echo
  echo "No APP_ACCESS_TOKEN provided, attempting /auth/test-login ..."
  TEST_LOGIN_RESPONSE="$(json_post_no_auth "/auth/test-login" "${TEST_LOGIN_PAYLOAD}")"
  if ! echo "${TEST_LOGIN_RESPONSE}" | jq -e '.accessToken' >/dev/null 2>&1; then
    echo "Failed to obtain app access token through /auth/test-login." >&2
    echo "Response:" >&2
    echo "${TEST_LOGIN_RESPONSE}" >&2
    echo >&2
    echo "Set APP_ACCESS_TOKEN manually or enable test auth locally." >&2
    exit 1
  fi
  APP_ACCESS_TOKEN="$(echo "${TEST_LOGIN_RESPONSE}" | jq -r '.accessToken')"
fi

echo
echo "1. Listing external AI clients ..."
CLIENTS_RESPONSE="$(json_get "/auth/external-ai/clients" "${APP_ACCESS_TOKEN}")"
echo "${CLIENTS_RESPONSE}" | jq

echo
echo "2. Creating authorization challenge ..."
AUTH_BODY="$(jq -cn \
  --arg clientKey "${CLIENT_KEY}" \
  --arg title "${AUTH_TITLE}" \
  --argjson scopes "${REQUESTED_SCOPES_JSON}" \
  '{clientKey: $clientKey, title: $title, scopes: $scopes}')"
AUTH_RESPONSE="$(json_post "/auth/external-ai/authorizations" "${APP_ACCESS_TOKEN}" "${AUTH_BODY}")"
echo "${AUTH_RESPONSE}" | jq

CHALLENGE_ID="$(echo "${AUTH_RESPONSE}" | jq -r '.challengeId')"
CHALLENGE_CODE="$(echo "${AUTH_RESPONSE}" | jq -r '.challengeCode')"
AUTHORIZATION_ID="$(echo "${AUTH_RESPONSE}" | jq -r '.authorizationId')"

if [[ -z "${CHALLENGE_ID}" || "${CHALLENGE_ID}" == "null" ]]; then
  echo "Authorization response did not include challengeId." >&2
  exit 1
fi

echo
echo "3. Exchanging one-time challenge for external AI token ..."
TOKEN_RESPONSE="$(json_post_no_auth "/auth/external-ai/token" "{\"challengeId\":\"${CHALLENGE_ID}\",\"challengeCode\":\"${CHALLENGE_CODE}\"}")"
echo "${TOKEN_RESPONSE}" | jq

EXTERNAL_AI_TOKEN="$(echo "${TOKEN_RESPONSE}" | jq -r '.accessToken')"
if [[ -z "${EXTERNAL_AI_TOKEN}" || "${EXTERNAL_AI_TOKEN}" == "null" ]]; then
  echo "Token response did not include accessToken." >&2
  exit 1
fi

echo
echo "4. Fetching /external-ai/context with external token ..."
CONTEXT_RESPONSE="$(json_get "/external-ai/context" "${EXTERNAL_AI_TOKEN}")"
echo "${CONTEXT_RESPONSE}" | jq

echo
echo "5. Verifying that external token is blocked from ${EXPECT_BLOCKED_ROUTE} ..."
BLOCKED_STATUS="$(
  curl -sS -o /tmp/external-ai-blocked-route.json -w "%{http_code}" \
    -H "Authorization: Bearer ${EXTERNAL_AI_TOKEN}" \
    "${BASE_URL}${EXPECT_BLOCKED_ROUTE}"
)"
cat /tmp/external-ai-blocked-route.json | jq || cat /tmp/external-ai-blocked-route.json
rm -f /tmp/external-ai-blocked-route.json

if [[ "${BLOCKED_STATUS}" != "403" ]]; then
  echo "Expected blocked route to return 403, got ${BLOCKED_STATUS}." >&2
  exit 1
fi

if [[ -n "${EXPECT_ALLOWED_ROUTE}" ]]; then
  echo
  echo "5b. Verifying that external token is allowed for ${EXPECT_ALLOWED_ROUTE} ..."
  ALLOWED_STATUS="$(
    curl -sS -o /tmp/external-ai-allowed-route.json -w "%{http_code}" \
      -H "Authorization: Bearer ${EXTERNAL_AI_TOKEN}" \
      "${BASE_URL}${EXPECT_ALLOWED_ROUTE}"
  )"
  cat /tmp/external-ai-allowed-route.json | jq || cat /tmp/external-ai-allowed-route.json
  rm -f /tmp/external-ai-allowed-route.json

  if [[ "${ALLOWED_STATUS}" -lt "200" || "${ALLOWED_STATUS}" -ge "300" ]]; then
    echo "Expected allowed route to return 2xx, got ${ALLOWED_STATUS}." >&2
    exit 1
  fi
fi

echo
echo "6. Revoking authorization ..."
REVOKE_RESPONSE="$(json_post "/auth/external-ai/authorizations/${AUTHORIZATION_ID}/revoke" "${APP_ACCESS_TOKEN}" "{\"authorizationId\":\"${AUTHORIZATION_ID}\"}")"
echo "${REVOKE_RESPONSE}" | jq

echo
echo "7. Verifying revoked external token no longer works ..."
REVOKED_STATUS="$(
  curl -sS -o /tmp/external-ai-revoked.json -w "%{http_code}" \
    -H "Authorization: Bearer ${EXTERNAL_AI_TOKEN}" \
    "${BASE_URL}/external-ai/context"
)"
cat /tmp/external-ai-revoked.json | jq || cat /tmp/external-ai-revoked.json
rm -f /tmp/external-ai-revoked.json

if [[ "${REVOKED_STATUS}" != "403" && "${REVOKED_STATUS}" != "401" ]]; then
  echo "Expected revoked token to fail, got ${REVOKED_STATUS}." >&2
  exit 1
fi

echo
echo "Done."
echo "External authorization created and revoked successfully for client ${CLIENT_KEY}."
