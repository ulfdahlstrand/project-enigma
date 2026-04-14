# Design: External AI Auth and Security Model

## Purpose

This document captures the security model for connecting external AI clients to the resume revision system.

It exists to answer one question:

How do we allow external LLM clients to edit resumes through the public API without creating an unsafe long-lived integration surface?

## Security principle

External AI clients should authenticate as a user, but with narrower, explicitly granted capabilities than the normal application session.

This means:

- no password sharing
- no reusing browser sessions
- no unscoped permanent API keys as the default
- no silent privileged access for a named LLM vendor

The external client is another client application acting on behalf of a user, not a special trusted backend.

## Threat model

## 1. Token theft

If a token is copied from:

- a local machine
- a prompt transcript
- a third-party connector
- logs or browser storage

then an attacker may be able to edit resumes as that user.

### Mitigation

- short-lived access tokens
- one-time exchange codes
- revocation support
- narrow scopes

## 2. Replay of one-time login

If the initial sign-in code can be used more than once, an attacker may establish their own session.

### Mitigation

- single-use login code
- short TTL
- server-side invalidation immediately after exchange

## 3. Over-broad permissions

If an external token can call every endpoint the UI can call, compromise impact becomes too large.

### Mitigation

- explicit scopes
- default to minimum scopes
- separate high-risk actions behind stronger scopes

## 4. Client impersonation

If the system cannot distinguish between different external client applications, a malicious tool could masquerade as an approved one.

### Mitigation

- model external clients as first-class records
- bind each authorization to a specific client id
- show the client identity to the user during approval

## 5. Context leakage

If internal-only prompts or orchestration instructions are exposed through the context endpoint, external clients may learn product internals or hidden workflow design.

### Mitigation

- strict external-safe context assembly
- separate internal workflow content from external guidance
- no raw dump of internal prompt inventory

## 6. Unsafe write automation

An external LLM may make incorrect or overly broad changes quickly.

### Mitigation

- branch-first workflow
- revision changes isolated from the main branch
- optional approval gates for merge/finalize/delete
- explicit audit logging

## 7. Poor attribution

If external edits are not clearly attributable, debugging and incident response become difficult.

### Mitigation

- every external action must log:
  - user id
  - external client id
  - authorization id
  - token id
  - resume id / branch id / commit id when applicable

## Recommended auth model

The safest practical first version is:

1. User starts a connection flow in the UI
2. Backend creates a one-time authorization challenge
3. External AI client exchanges the challenge for a short-lived access token
4. That token is scoped to specific API capabilities
5. User can revoke the authorization at any time

This is closer to a device-code / one-time approval model than to a static API key model.

## Recommended entities

## `external_ai_clients`

Represents a known client application.

Suggested fields:

- `id`
- `key`
- `title`
- `description`
- `is_active`
- `created_at`
- `updated_at`

Examples:

- `anthropic_claude_desktop`
- `openai_chatgpt_connector`
- `custom_mcp_client`

## `external_ai_authorizations`

Represents a user's approved connection to one external client.

Suggested fields:

- `id`
- `user_id`
- `client_id`
- `title`
- `scopes`
- `status`
- `last_used_at`
- `expires_at`
- `created_at`
- `updated_at`

Suggested statuses:

- `pending`
- `active`
- `revoked`
- `expired`

## `external_ai_login_challenges`

Short-lived, one-time approval records.

Suggested fields:

- `id`
- `authorization_id`
- `challenge_code_hash`
- `expires_at`
- `used_at`
- `created_at`

Important:

- store only a hash if the code is sensitive
- mark `used_at` on successful exchange

## `external_ai_access_tokens`

Represents issued client credentials or token records.

Suggested fields:

- `id`
- `authorization_id`
- `token_hash`
- `scopes`
- `expires_at`
- `last_used_at`
- `revoked_at`
- `created_at`

Important:

- do not store raw long-lived secrets
- prefer hashed token storage

## Recommended scopes

The first version should use explicit scopes.

Suggested scope families:

- `resume:read`
- `resume:branch:create`
- `resume:branch:read`
- `resume:branch:update`
- `resume:commit:create`
- `resume:commit:read`
- `resume:revision:read`
- `resume:revision:write`
- `resume:merge`
- `resume:delete`
- `ai:context:read`

### Safe default for first release

A good first default bundle would be:

- `resume:read`
- `resume:branch:create`
- `resume:branch:read`
- `resume:branch:update`
- `resume:commit:create`
- `resume:commit:read`
- `resume:revision:read`
- `resume:revision:write`
- `ai:context:read`

### High-risk scopes

These should be withheld by default or require explicit approval:

- `resume:merge`
- `resume:delete`
- any bulk destructive scope

## Recommended flow

## Step 1. Start connection

The user chooses "Connect external AI" in the UI.

The backend creates:

- an `external_ai_authorization`
- a one-time login challenge

## Step 2. User approves

The UI shows:

- which client is being connected
- what scopes are being requested
- expiration or trust duration

## Step 3. Client exchanges code

The external client sends the one-time code to the backend.

The backend verifies:

- code validity
- not expired
- not already used
- authorization still pending or active

Then it issues a short-lived access token.

## Step 4. Client uses the API

The external client calls the same public endpoints as any other client, but only within its scopes.

## Step 5. Revocation and expiry

The user can revoke the authorization.

The system should also expire:

- unused login challenges
- short-lived access tokens
- stale authorizations if appropriate

## Why not plain PATs as the primary model

Plain PATs are simple, but they have meaningful downsides:

- often long-lived
- easy to paste into unsafe places
- hard to scope precisely unless we build a lot around them
- weaker user understanding of what was granted

PAT support could still exist later for advanced clients, but it should not be the default first-step integration model.

## Why not reuse browser sessions

Browser sessions are bound to the web app and user browser assumptions.

External AI clients should not inherit:

- browser cookies
- frontend session state
- hidden implicit trust

This would be brittle and unsafe.

## Audit logging requirements

Every external-client action should log:

- timestamp
- user id
- client id
- authorization id
- token id
- endpoint called
- affected entity ids where relevant
- success/failure

This is necessary for:

- incident response
- debugging
- user trust
- revocation verification

## Context exposure rules

The auth system and context endpoint must work together.

An authenticated external AI client should only receive:

- external-safe guidance
- shared rules
- public workflow guidance
- public tool/API descriptions

It should not receive:

- internal-only prompt fragments
- internal orchestration prompts
- hidden frontend-specific behavior

## Recommended step-1 deliverables

The first implementation step should include:

1. External client model
2. One-time sign-in / approval flow
3. Short-lived scoped access token support
4. Revocation support
5. Authenticated external context endpoint
6. Audit logging for all external token usage

## Non-goals for the first step

The first step does not need:

- a full MCP server
- consultant-level preference editing UI
- full tool coverage for every resume section
- complex token refresh choreography if short-lived re-auth is enough initially

## Final recommendation

The external AI login should be:

- one-time approved
- client-bound
- scope-bound
- short-lived
- revocable
- auditable

That is the safest first version and supports more than one LLM client without hardcoding trust in any single vendor.
