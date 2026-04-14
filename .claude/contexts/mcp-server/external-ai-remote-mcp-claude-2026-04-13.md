# External AI Remote MCP for Claude — 2026-04-13

## Summary

We verified that the Project Enigma remote MCP transport now works technically:

- `GET /mcp` returns `405 Method not allowed` instead of frontend HTML
- the local dev stack can proxy `/mcp` through Vite
- the backend can serve the remote MCP adapter over HTTP
- the existing external AI API auth flow works over both localhost and ngrok

However, we also verified that the current remote MCP bootstrap model is not sufficient for Claude remote connectors.

The current MCP adapter still expects one of:

- an `accessToken`
- or `challengeId` + `challengeCode`

at adapter startup.

That works for local/manual testing, but it is not the right final integration model for Claude remote MCP.

## What Claude Remote MCP Expects

Based on Anthropic / Claude documentation:

- Remote MCP servers are reached from Anthropic's cloud, not from the user's local machine.
- The server should be publicly reachable over HTTPS.
- Claude supports remote MCP transports such as Streamable HTTP and SSE.
- Claude remote connectors support:
  - authless servers
  - OAuth-based servers
- OAuth/token expiry/refresh are expected to be handled in a connector-compatible way.

Implication:

Claude does not connect to a remote MCP server by manually sending our `challengeId` and `challengeCode` into the MCP transport.

So our current bootstrap model:

- "connect to `/mcp`"
- then have the server expect `challengeId` / `challengeCode` from env or startup config

is good enough for development, but not good enough for a real Claude remote connector.

## What We Learned From Testing

### Confirmed working

- `/api/health` works through ngrok
- `/mcp` now reaches the MCP server instead of the frontend app
- external AI token exchange works remotely:
  - `POST /auth/external-ai/token`
- external AI context works remotely:
  - `GET /external-ai/context`
- allowed routes and prompt guidance are returned correctly

### Confirmed missing

The remote MCP server still lacks a proper user/session binding model for remote clients.

When Claude connects directly to `/mcp`, the adapter does not know:

- which Project Enigma user it should act as
- which external AI authorization it should use
- how it should bootstrap access without env-based local secrets

That is why we still see errors such as:

- missing access token
- missing challenge ID / challenge code

These are not transport problems anymore.
They are bootstrap/auth design problems.

## Architectural Conclusion

The current external AI auth model should remain as a backend building block, but it should not be the public-facing auth contract for Claude remote MCP.

We should move toward:

- a real remote-MCP-compatible auth/bootstrap flow
- preferably OAuth-based for Claude compatibility

instead of exposing:

- `challengeId`
- `challengeCode`
- or local env tokens

directly to the remote MCP adapter.

## Recommended Direction

### Short version

Keep:

- the public external AI API
- scopes
- context endpoint
- refresh-token lifecycle
- thin MCP adapter

Change:

- how the remote MCP adapter learns which user/session it belongs to

### Preferred target model

Implement a Claude-compatible remote MCP auth/bootstrap flow where:

1. the user initiates connection from the Project Enigma web app
2. the user authorizes Claude as an external client
3. the remote MCP server receives a connector-compatible token/session
4. the MCP server resolves the linked Project Enigma authorization server-side
5. access token refresh happens behind the scenes

This should feel like a normal connector:

- connect once
- use many times
- reconnect only when the authorization is revoked or expired

## Why OAuth Is the Likely Right Direction

Claude docs explicitly describe remote MCP connectors as supporting:

- authless
- OAuth-based

Since Project Enigma is user-specific and write-capable, authless is not appropriate.

That leaves OAuth-style integration as the most natural target.

Even if our current backend internally continues to use:

- external AI authorizations
- short-lived access tokens
- refresh tokens

the remote MCP facade presented to Claude should likely be OAuth-compatible rather than challenge-based.

## Suggested Next Implementation Step

When we return to this:

1. design the remote MCP bootstrap/auth model specifically for Claude
2. map current external AI auth concepts onto that model
3. decide whether to:
   - implement a true OAuth-compatible connector flow
   - or add a temporary server-side session bootstrap layer that can later evolve into OAuth
4. only after that, continue productizing Claude remote MCP

## Important Non-goals

Do not continue down these paths as the final solution:

- requiring `.env` for end users
- requiring the user to manually provide `challengeId` / `challengeCode` to Claude remote MCP
- making remote MCP depend on local desktop-only setup

Those are okay for development and validation, but not for the productized remote connector.

## Current State Snapshot

At the point this document was written:

- remote MCP transport works
- Vite proxy for `/mcp` exists
- backend dev starts MCP in parallel
- external AI context and routes are usable
- assignment listing has been exposed as a dedicated MCP tool
- `list_resumes` is still missing from the external AI / MCP surface
- broader remote connector auth is the main unresolved problem

## Related Context Files

- `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external ia/external-ai-revision-flow-2026-04-09.md`
- `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external ia/external-ai-revision-overview-2026-04-10.md`
- `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external ia/external-ai-auth-security-2026-04-10.md`
- `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/mcp-server/external-ai-token-lifecycle-2026-04-11.md`
- `/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/mcp-server/mcp-server-separate-service-2026-04-13.md`
