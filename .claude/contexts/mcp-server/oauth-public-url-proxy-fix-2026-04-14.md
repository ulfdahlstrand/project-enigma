# OAuth Public URL Proxy Fix — 2026-04-14

## Problem

When Claude Code tried to authenticate against the remote MCP server via the configured
ngrok URL (`https://<tunnel>/mcp`), it consistently failed with:

```
SDK auth failed: Protected resource http://127.0.0.1:8787 does not match expected
https://<tunnel>.ngrok-free.app/mcp (or origin).
```

## Root Cause

The MCP server (`apps/mcp/src/server.ts`) used a static `publicUrl` variable — derived
from `EXTERNAL_AI_MCP_PUBLIC_URL` in `.env` — for all three OAuth discovery responses
and for the `WWW-Authenticate` header on the `/mcp` 401 response.

The `.env` value was `http://localhost:5173` (wrong) and was later corrected to
`http://127.0.0.1:8787` (the MCP server's local listen address). Neither is the URL
that the MCP client (Claude Code) sees.

### Why the MCP client sees `127.0.0.1:8787`

The setup uses a **single ngrok tunnel → Vite dev server (5173)**, not a direct tunnel
to the MCP server:

```
Claude Code → ngrok (https://<tunnel>) → Vite :5173 → proxy → MCP :8787
```

Vite proxies these paths to the MCP server:
- `/mcp`
- `/.well-known/*`
- `/register`
- `/oauth/token`

The OAuth flow works as follows:

1. Claude Code POSTs to `https://<tunnel>/mcp` — no token, gets 401
2. Reads `WWW-Authenticate: Bearer ..., resource_metadata="<url>/.well-known/oauth-protected-resource"`
3. Fetches `<url>/.well-known/oauth-protected-resource` to discover the authorization server
4. Uses the `authorization_servers` URL to fetch `/.well-known/oauth-authorization-server`
5. Redirects the user to `authorization_endpoint` for the approval page
6. Exchanges the auth code at `token_endpoint`

If step 2's URL is `http://127.0.0.1:8787`, Claude Code fetches metadata from port 8787
**directly** (bypassing ngrok), which returns `http://127.0.0.1:8787` as the resource —
mismatching the configured server URL.

## Fix

Two changes in `apps/mcp/src/server.ts`:

### 1. `resolvePublicUrlFromRequest()` helper

Added a function that reads `X-Forwarded-Proto` and `X-Forwarded-Host` headers from
the incoming request. Ngrok (and most reverse proxies) set these automatically.

```ts
function resolvePublicUrlFromRequest(req: IncomingMessage, fallback: string): string {
  const proto = Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"];
  const forwardedHost = Array.isArray(req.headers["x-forwarded-host"])
    ? req.headers["x-forwarded-host"][0]
    : req.headers["x-forwarded-host"];
  const host = forwardedHost ?? req.headers["host"];

  if (proto && host) {
    return `${proto}://${host}`;
  }

  return fallback;
}
```

### 2. All discovery endpoints and 401 header use per-request URL

- `GET /.well-known/oauth-protected-resource` — uses `resolvePublicUrlFromRequest`
- `GET /.well-known/oauth-authorization-server` — uses `resolvePublicUrlFromRequest`
- `GET /.well-known/openid-configuration` — uses `resolvePublicUrlFromRequest`
- `POST /mcp` 401 `WWW-Authenticate` header — uses `resolvePublicUrlFromRequest`

The `appUrl` (authorization endpoint / frontend) still comes from
`EXTERNAL_AI_MCP_APP_URL` because that is always the Vite/frontend origin regardless
of the proxy hop.

### 3. `.env.example` updated

`EXTERNAL_AI_MCP_PUBLIC_URL` default changed from `http://localhost:5173` to
`http://127.0.0.1:8787` and the comment updated to explain it is only a fallback for
direct local access without forwarding headers.

## Keychain Discovery State

Claude Code caches the MCP server's discovered OAuth metadata in the macOS Keychain
under `Claude Code-credentials`. When a new ngrok URL is used or the discovery state is
stale, the cache may contain the old URLs and cause auth to fail even after the server
is fixed.

The cache entry is keyed by `"project-enigma-dev|<hash>"` and looks like:

```json
{
  "discoveryState": {
    "authorizationServerUrl": "http://127.0.0.1:8787",
    "resourceMetadataUrl": "http://localhost:5173/.well-known/oauth-protected-resource"
  }
}
```

**Fix:** Use `security find-generic-password -s "Claude Code-credentials" -w` to read
the JSON blob, update `discoveryState` for the relevant entry, then write back with
`security add-generic-password -U ...`.

After updating the keychain, retry the `authenticate` tool — Claude Code will use the
fresh discovery state and the OAuth flow will proceed correctly.

## Current State (after fix)

- The MCP server self-describes its public URL from request headers — no env change
  needed when the ngrok URL rotates, as long as requests come through the tunnel.
- `EXTERNAL_AI_MCP_PUBLIC_URL` in `.env` should be set to the ngrok URL as a fallback
  for the case where Claude Code fetches metadata from the local port directly (i.e.,
  when the SDK hits port 8787 during auth without proxy headers).
- All MCP tools are available and authenticated in the current session.

## Related Context Files

- `.claude/contexts/mcp-server/external-ai-remote-mcp-claude-2026-04-13.md` — background on OAuth flow design
- `.claude/contexts/mcp-server/mcp-server-separate-service-2026-04-13.md` — MCP as separate turbo app
- `.claude/contexts/mcp-server/external-ai-token-lifecycle-2026-04-11.md` — token lifecycle
