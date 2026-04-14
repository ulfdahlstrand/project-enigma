# Overview: External AI Revision Flow

## Purpose

This document is the high-level index for the external AI revision work.

It is intentionally broken into implementation steps so we can keep token usage low and focus on one decision area at a time.

Each step should be understandable without loading every design document at once.

## Core outcome

We want an external AI client to revise resumes through the same API surface as the internal product, while:

- following shared CV rules
- using a secure login model
- avoiding leakage of internal workflow prompts
- supporting complete editing coverage across the resume

## Related documents

### 1. External AI flow

- [external-ai-revision-flow-2026-04-09.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-revision-flow-2026-04-09.md)

Focus:

- overall product direction
- context endpoint
- API-first architecture
- MCP as thin adapter, not primary system

### 2. Prompt / rule / validator model

- [ai-rule-model-for-external-clients-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/ai-rule-model-for-external-clients-2026-04-10.md)

Focus:

- layered AI instruction model
- separation of:
  - base
  - agent
  - consultant
  - workflow
  - context
  - output contract
- separation of shared vs internal-only material

### 3. Auth and security

- [external-ai-auth-security-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-auth-security-2026-04-10.md)

Focus:

- external AI login flow
- one-time approval model
- scoped short-lived tokens
- threats and mitigations

## Implementation breakdown

## Step 1: External client auth and safe context

### Goal

Allow an external AI client to connect securely and read the external-safe context it needs before doing any edits.

### Includes

- external AI client model
- one-time sign-in / approval flow
- scoped short-lived tokens
- revocation support
- authenticated context endpoint
- shared rules and external-safe guidance only

### Does not include

- full edit coverage for every resume section
- full MCP adapter
- consultant preference editing UI

### Primary documents

- [external-ai-auth-security-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-auth-security-2026-04-10.md)
- [ai-rule-model-for-external-clients-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/ai-rule-model-for-external-clients-2026-04-10.md)

## Step 2: Editing capability audit and API completeness

### Goal

Verify that an external AI client can actually edit all meaningful parts of the resume through the public API.

### Areas to audit

- resume title
- consultant title
- presentation
- summary
- highlighted items
- skills
- skill groups
- assignments
- education
- branch creation
- commit creation
- merge/finalize flow

### Questions to answer

- Which sections are already editable through existing endpoints?
- Which sections are only editable through internal UI-only assumptions?
- Which payloads are too text-only and need richer object context?
- Are there missing endpoints or missing response fields for external clients?

### Output of step 2

- a gap list
- API additions or changes needed
- priority order for closing the gaps

### Primary documents

- [external-ai-revision-flow-2026-04-09.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-revision-flow-2026-04-09.md)
- [ai-rule-model-for-external-clients-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/ai-rule-model-for-external-clients-2026-04-10.md)

## Step 3: Rule model and prompt composition implementation

### Goal

Move from flat prompt definitions toward a layered model where shared rules are reusable and internal workflow remains isolated.

### Includes

- rule categories
- rules
- validators
- prompt-to-rule links
- consultant preference overlays
- workflow guidance separation

### Important

This step should not expose internal prompt inventory directly to external clients.

The external context should be assembled from:

- shared rules
- external workflow guidance
- public tool/API guides

Not from raw internal prompt fragments.

### Primary documents

- [ai-rule-model-for-external-clients-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/ai-rule-model-for-external-clients-2026-04-10.md)

## Step 4: External tool/API contract

### Goal

Define how the external AI discovers and uses the available operations.

### Includes

- tool catalog in context endpoint
- public operation descriptions
- request/response examples
- guidance on branch -> edit -> commit workflow

### Notes

This is still API-first.

MCP, if added, should be a thin adapter over this contract.

### Primary documents

- [external-ai-revision-flow-2026-04-09.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-revision-flow-2026-04-09.md)

## Step 5: MCP adapter

### Goal

Optionally expose the same external AI contract through MCP, without introducing a new source of truth.

### Includes

- tool wrappers that call the existing API
- loading system/context data from the context endpoint

### Important

This is not step 1.

It should happen only after:

- auth works
- context endpoint exists
- API coverage is sufficient
- external-safe guidance is clearly separated

### Primary documents

- [external-ai-revision-flow-2026-04-09.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-revision-flow-2026-04-09.md)

## Working principles

These principles apply across all steps:

- external AI uses the same API surface as internal clients
- internal orchestration should not leak externally
- shared rules should not be duplicated across prompts
- consultant-specific preferences should be modeled separately from agent identity
- assignment-level work should receive full assignment context, not just raw description text
- auth should be scoped, short-lived, and revocable

## Suggested workflow for implementation sessions

To reduce token usage, use the documents selectively:

### If working on auth

Load:

- [external-ai-auth-security-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-auth-security-2026-04-10.md)

### If working on prompt/rule modeling

Load:

- [ai-rule-model-for-external-clients-2026-04-10.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/ai-rule-model-for-external-clients-2026-04-10.md)

### If working on system architecture or API shape

Load:

- [external-ai-revision-flow-2026-04-09.md](/Users/ulfdahlstrand/Projects/Code/Work/SthlmTech/project-enigma/.claude/contexts/external-ai-revision-flow-2026-04-09.md)

### If planning the whole feature

Load:

- this overview document
- then only the detailed document for the active step

## Recommended current next step

The best next implementation step is:

### Step 1

Design and implement the external AI auth flow and external-safe context endpoint.

That should happen before the full editing-capability work because:

- auth is foundational
- external-safe context must exist before any client can use the flow correctly
- the login model affects how all later integration points are designed
