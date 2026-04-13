# MCP Server as a Separate Service — 2026-04-13

## Summary

After validating the current in-repo remote MCP implementation, the likely better long-term architecture is to run the MCP server as its own separate service.

This should be treated as a future follow-up step, not as something that must block the current learning/prototyping work.

## Why a Separate Service Is Probably Better

### 1. Clearer responsibility boundaries

Today the repository contains:

- the product web app
- the public API
- the external AI context and auth flows
- and now an MCP server layer

That was useful for proving the concept, but it also creates a middle state where:

- Vite proxy participates in MCP testing
- backend dev startup needs to launch both API and MCP
- remote connector concerns bleed into normal app/dev concerns

A separate MCP service would make the boundary clearer:

- Project Enigma app/API = product and domain logic
- MCP service = connector adapter only

### 2. Better fit for remote connector hosting

For Claude, ChatGPT, and Codex, the MCP server should ultimately behave like a real remote integration endpoint:

- publicly reachable
- independently deployable
- independently observable
- compatible with connector auth/bootstrap expectations

That is easier to reason about when MCP is its own service rather than a sidecar hidden inside the main dev stack.

### 3. Cleaner auth evolution

The current MCP bootstrap still reflects local/manual testing patterns:

- env-provided tokens
- challenge-based bootstrap

That is acceptable for validation, but a real remote connector likely needs:

- OAuth-compatible auth
- or another server-side session/bootstrap model specifically designed for remote clients

That evolution will be easier if the MCP server is treated as its own runtime and integration surface.

### 4. Easier multi-client support

A separate MCP service is a better foundation for supporting:

- Claude
- ChatGPT
- Codex
- future MCP-capable clients

The service can remain thin while still being client-agnostic.

### 5. Reduced accidental coupling to frontend/dev setup

The current implementation required:

- a Vite `/mcp` proxy
- backend dev changes to start MCP alongside the API

Those changes were useful for development, but they are signs that MCP is currently living inside the product app's workflow rather than standing on its own.

## What Should Stay the Same

Making MCP a separate service does **not** mean building a second business system.

The MCP service should still remain thin.

It should continue to:

- use the public external AI API
- fetch `/external-ai/context`
- expose only allowed routes as tools
- handle token/session lifecycle
- avoid owning business rules or domain truth

It should **not**:

- query the product database directly
- duplicate resume logic
- invent separate write flows
- become an alternative backend

## Recommended Future Shape

### Product/API service

Owns:

- resumes
- branches
- commits
- assignments
- education
- external AI auth
- context generation
- scopes
- authorization and revocation state

### MCP service

Owns:

- MCP transport
- connector bootstrap/auth handoff
- tool registration based on allowed routes
- access token refresh behind the scenes
- compatibility with remote MCP clients

## Suggested Follow-up Work

When this becomes an active workstream again, the next planning pass should evaluate:

1. service boundaries
2. deployment shape
3. connector-compatible auth/bootstrap
4. whether the current in-repo MCP code should be:
   - extracted directly
   - or first stabilized and then moved

## Proposed Future Task

Create a separate initiative for:

`Extract Project Enigma MCP adapter into a dedicated remote service`

That initiative should cover:

- architecture decision
- deployment approach
- auth/bootstrap redesign for remote connectors
- migration plan from the in-repo MCP implementation

## Recommendation

The current repository implementation should be treated as:

- a valid prototype
- a strong technical proof
- but not necessarily the final deployment architecture

The likely best destination is:

- separate MCP service
- thin adapter
- same public API underneath

