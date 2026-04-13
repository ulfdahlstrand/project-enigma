# Design: External AI Token Lifecycle

## Purpose

This document covers the refresh token model and token lifecycle management for external AI client authorizations.

Complements `external-ai-auth-security-2026-04-10.md`.

---

## Refresh tokens

### Decision

Refresh tokens are supported for external AI authorizations. They allow an external AI session to stay alive without requiring the user to re-approve mid-session, while keeping the authorization bounded to a duration chosen by the user at approval time.

### Why bounded, not indefinite

A refresh token with no expiry is functionally identical to a long-lived PAT — the exact risk the auth model was designed to avoid. By tying the refresh token's validity to the authorization's chosen duration, the user retains meaningful control. When the authorization expires, no further refreshes are possible regardless of whether the refresh token itself is still present.

### Duration options

The user selects one of the following when creating an authorization:

| Option | Max session length |
|--------|--------------------|
| 1h     | One hour           |
| 4h     | Four hours         |
| 8h     | Eight hours        |
| 1d     | One day            |
| 7d     | Seven days         |

This duration sets `expires_at` on the `external_ai_authorization`. The refresh token cannot be used beyond that timestamp regardless of when it was issued.

### How it works

1. On successful code exchange, the backend issues:
   - A short-lived **access token** (e.g. 15–30 minutes)
   - A **refresh token** stored as a hash, valid until the authorization's `expires_at`
2. When the access token expires, the external client POSTs the refresh token to the refresh endpoint
3. Backend verifies:
   - Refresh token hash matches
   - Authorization is still active (not revoked, not expired)
   - Authorization `expires_at` has not passed
4. If valid: issue a new access token (same scopes, same authorization)
5. If the authorization has expired or been revoked: return 401, no new token issued

### Refresh token storage

- Stored as a hash in `external_ai_access_tokens` (reuse the existing table, add a `refresh_token_hash` column)
- Or as a separate `external_ai_refresh_tokens` table if multiple refresh tokens per authorization are needed (simpler to keep one per authorization for v1)
- Raw refresh token returned once at exchange, never stored in plaintext

### Refresh endpoint

`POST /external-ai/authorizations/refresh`

Body: `{ refresh_token: string }`

Response: `{ access_token: string, expires_in: number }`

No new refresh token is issued on refresh — the original refresh token remains valid until the authorization expires.

### Revocation behaviour

Revoking the authorization immediately invalidates both the access token and the refresh token. The external client will receive a 401 on its next refresh attempt.

---

## Token and authorization lifecycle management

### Deleting revoked authorizations

Users should be able to hard-delete revoked authorizations from the UI. A revoked authorization is already invalid — keeping it is only necessary if an audit log is required. For v1, hard delete is sufficient since audit logging is handled separately.

- Only **revoked** or **expired** authorizations may be deleted
- **Active** authorizations must be revoked before deletion (or the UI offers a combined revoke-and-delete action)
- Deletion cascades to all linked token records

Endpoint: `DELETE /external-ai/authorizations/:id`
- Returns 409 if the authorization is still active
- Returns 204 on success

### Deleting expired tokens

Expired authorizations and their tokens should be deletable from the UI alongside revoked ones. Same endpoint and rules apply — status must be `revoked` or `expired` to allow deletion.

A background cleanup job (or on-demand) can also purge authorizations that have been expired for more than N days. This is a nice-to-have for v1.

### UI states and allowed actions

| Status   | Revoke | Delete |
|----------|--------|--------|
| pending  | yes    | no     |
| active   | yes    | no     |
| revoked  | —      | yes    |
| expired  | —      | yes    |

---

## Summary of changes to existing auth design

These additions extend `external-ai-auth-security-2026-04-10.md`:

1. Add `refresh_token_hash` and `refresh_token_expires_at` to token storage
2. Add `POST /external-ai/authorizations/refresh` endpoint
3. Add duration selector (1h / 4h / 8h / 1d / 7d) to the authorization creation flow
4. Add `DELETE /external-ai/authorizations/:id` with status guard
5. Expired authorizations are deletable alongside revoked ones
