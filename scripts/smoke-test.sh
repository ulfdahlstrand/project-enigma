#!/usr/bin/env bash
# =============================================================================
# smoke-test.sh — End-to-end stack connectivity smoke test (AC9)
#
# Verifies that the backend test endpoint responds with HTTP 200 and a
# non-empty JSON body after the Docker Compose stack has started.
#
# Usage (from repo root):
#   ./scripts/smoke-test.sh
#
# Prerequisites:
#   - Docker Compose stack must be running: `docker compose -f docker/docker-compose.yml up -d`
#   - curl must be installed
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — read from environment or use defaults that match .env.example
# ---------------------------------------------------------------------------
BACKEND_PORT="${BACKEND_PORT:-3001}"
BACKEND_HOST="localhost"
BASE_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
TIMEOUT_SECONDS=60
POLL_INTERVAL=3

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()  { echo "[smoke-test] $*"; }
pass() { echo "[smoke-test] ✅ PASS: $*"; }
fail() { echo "[smoke-test] ❌ FAIL: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Wait for the backend health endpoint to become available
# ---------------------------------------------------------------------------
log "Waiting up to ${TIMEOUT_SECONDS}s for backend to become healthy at ${BASE_URL}/health …"

elapsed=0
until curl -sf "${BASE_URL}/health" > /dev/null 2>&1; do
  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    fail "Backend did not become healthy within ${TIMEOUT_SECONDS} seconds."
  fi
  sleep "$POLL_INTERVAL"
  elapsed=$(( elapsed + POLL_INTERVAL ))
done

pass "Backend is healthy (${BASE_URL}/health responded within ${elapsed}s)."

# ---------------------------------------------------------------------------
# Verify the listTestEntries endpoint returns HTTP 200 + non-empty JSON body
#
# The OpenAPIHandler maps the `listTestEntries` procedure to:
#   GET /listTestEntries
# ---------------------------------------------------------------------------
ENDPOINT="${BASE_URL}/listTestEntries"
log "Checking test endpoint: GET ${ENDPOINT}"

HTTP_STATUS=$(curl -s -o /tmp/smoke-response.json -w "%{http_code}" "${ENDPOINT}")
BODY=$(cat /tmp/smoke-response.json)

if [ "$HTTP_STATUS" != "200" ]; then
  fail "Expected HTTP 200 from ${ENDPOINT}, got ${HTTP_STATUS}. Body: ${BODY}"
fi
pass "HTTP 200 received from ${ENDPOINT}."

if [ -z "$BODY" ]; then
  fail "Response body from ${ENDPOINT} is empty."
fi
pass "Non-empty JSON body received: ${BODY}"

# ---------------------------------------------------------------------------
# Verify the response contains the 'entries' key
# ---------------------------------------------------------------------------
if ! echo "$BODY" | grep -q '"entries"'; then
  fail "Response body does not contain expected 'entries' key. Body: ${BODY}"
fi
pass "'entries' key present in response body."

log "All smoke tests passed. ✅"
