# External AI — MCP Setup Guide

This document describes how to connect an external AI agent (Claude Code or any
MCP-capable client) to the project-enigma backend as a remote MCP server.
It is written for the AI doing the setup, not for humans.

---

## 1. What the MCP server exposes

Call `GET /api/external-ai/context` (see Step 3) immediately after connecting.
It returns the full workflow instructions, allowed routes, prompt guidance, and
safety rules that govern everything you are allowed to do on behalf of the user.
Always read it before taking any action.

---

## 2. Prerequisites

| Item | Value |
|------|-------|
| MCP URL | provided by the user or the server operator |
| API base URL | same host as MCP URL, path prefix `/api` |
| Auth type | Bearer token (short-lived, ~30 min) with a 7-day refresh token |
| Token exchange endpoint | `POST /api/auth/external-ai/token` |
| Token refresh endpoint | `POST /api/auth/external-ai/token/refresh` |
| Context endpoint | `GET /api/external-ai/context` |

---

## 3. Step-by-step setup

### 3a. Obtain a one-time challenge

The user must generate a `challengeId` + `challengeCode` pair from the
application UI (Settings → AI integrations → New challenge). These are
single-use and expire quickly (~5 minutes). Ask the user to paste them.

### 3b. Exchange the challenge for tokens

```http
POST /api/auth/external-ai/token
Content-Type: application/json

{
  "challengeId": "<challengeId from user>",
  "challengeCode": "<challengeCode from user>"
}
```

Successful response:
```json
{
  "accessToken": "eai_…",
  "expiresAt": "<ISO-8601>",
  "refreshToken": "eair_…",
  "refreshTokenExpiresAt": "<ISO-8601>",
  "scopes": ["resume:read", "resume-branch:read", …]
}
```

Save **both** tokens and the expiry timestamps.

### 3c. Register the MCP server in Claude Code

```bash
claude mcp add <server-name> "<MCP_URL>" \
  --transport http \
  -H "Authorization: Bearer <accessToken>"
```

This writes the header into `~/.claude.json` under
`projects[<project-path>].mcpServers[<server-name>].headers.Authorization`.

### 3d. Fetch the AI context

```http
GET /api/external-ai/context
Authorization: Bearer <accessToken>
```

Inspect `allowedRoutes` to know which API routes you may call and which
scope each one requires. Also read `workflow.steps` for the intended editing
flow and `sharedGuidance` / `safetyGuidance` for rules you must follow.

---

## 4. Token refresh

Access tokens expire in ~30 minutes. Use the refresh token to get a new one:

```http
POST /api/auth/external-ai/token/refresh
Content-Type: application/json

{
  "refreshToken": "eair_…"
}
```

Response has the same shape as the initial exchange. Patch the `Authorization`
header in `~/.claude.json` with the new `accessToken`.

Refresh tokens are valid for 7 days. After expiry the user must generate a new
challenge.

### Automated refresh (Claude Code)

A Python script at `~/.claude/scripts/enigma-token-refresh.py` handles this
automatically:

- Reads token state from `~/.claude/scripts/enigma-tokens.json`
- No-ops if the access token expires more than 10 minutes from now
- Calls the refresh endpoint and patches both `~/.claude.json` and the state file

It is registered as a `UserPromptSubmit` hook in `~/.claude/settings.json` so
it runs at the start of every Claude Code prompt before any tool is invoked.

To bootstrap the state file after a fresh challenge exchange:

```json
// ~/.claude/scripts/enigma-tokens.json
{
  "accessToken": "<accessToken>",
  "accessTokenExpiresAt": "<expiresAt>",
  "refreshToken": "<refreshToken>",
  "refreshTokenExpiresAt": "<refreshTokenExpiresAt>"
}
```

---

## 5. Re-authentication (after refresh token expiry)

1. User generates a new challenge in the UI.
2. Call `POST /api/auth/external-ai/token` with the new challenge.
3. Update `~/.claude/scripts/enigma-tokens.json` with the new tokens.
4. Patch `~/.claude.json` with the new `accessToken` (or re-run `claude mcp add`).

---

## 6. Key things the context endpoint tells you

| Field | Purpose |
|-------|---------|
| `allowedRoutes` | Exact HTTP methods + paths you may call, with required scope per route |
| `scopes` | Your current permission set |
| `workflow.steps` | Ordered steps for the resume revision workflow |
| `sharedGuidance` | Language, scope, and style rules |
| `safetyGuidance` | Hard constraints (no invented facts, branch-first edits, API-only) |
| `promptGuidance` | Section-specific prompt fragments for assignments, presentation, etc. |

Do not assume any route is available without checking `allowedRoutes` first.
