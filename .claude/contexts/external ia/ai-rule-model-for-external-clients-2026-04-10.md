# Design: Layered AI Prompt, Rule, and Validator Model

## Purpose

This document defines how AI instruction content should be structured so that:

- internal AI flows remain flexible
- external AI clients can use the same core guidance safely
- shared guidance is not duplicated across prompts
- internal workflow behavior does not leak to external clients
- each consultant can add personal CV preferences

This document supersedes the simpler "guidelines table" idea. The core insight is that we do not really have "prompts" as one flat thing. We have multiple layers that are assembled into a final AI request.

## Core principle

A final AI request should be assembled from layers, not authored as one large prompt string.

Those layers should separate:

- universal system behavior
- agent/use-case behavior
- consultant-specific preferences
- workflow behavior
- concrete resume context
- output expectations

This makes it possible to share what should be shared and isolate what should stay private.

## The full model

The recommended conceptual model is:

1. Base prompt
2. Base rules
3. Base validators
4. Agent prompt
5. Agent rules
6. Agent validators
7. Consultant preferences
8. Consultant rules
9. Consultant validators
10. Workflow instructions
11. Context payload
12. Output contract

These are not all stored the same way. Some are reusable records in the database, some are structured runtime context, and some are prompt fragments.

## Why this split matters

Without this separation, the current system tends to mix:

- CV writing guidance
- internal orchestration logic
- frontend chat behavior
- prompt-local formatting conventions
- consultant-specific style preferences

That causes three problems:

1. Duplication
The same rules appear in many prompt builders.

2. Leakage
External clients receive internal workflow details they should never need to know.

3. Drift
Internal AI and external AI gradually stop following the same core rules.

## Layer-by-layer definition

## 1. Base prompt

### Purpose

Defines the most stable, high-level identity of the AI.

### What belongs here

- what the AI fundamentally is
- broad purpose
- stable constraints that are unlikely to vary per feature

### What does not belong here

- workflow sequencing
- section-specific instructions
- consultant-specific style
- tool usage details

### Example

"You are an expert assistant for improving consulting CV content while preserving factual accuracy."

### Notes

This layer should be short and stable.

## 2. Base rules

### Purpose

Reusable general rules that apply across most AI use cases.

### Examples

- Write in the same language as the source text
- Stay within the user's requested scope
- Do not invent experience, roles, outcomes, or technologies
- Be concise and professional
- Do not claim that changes are already applied

### Characteristics

- shared by many prompts
- mostly external-safe
- should rarely reference UI or workflow implementation

## 3. Base validators

### Purpose

Structured quality checks that define what a valid response must satisfy.

### Examples

- `same_language_as_source`
- `no_fabricated_facts`
- `scope_respected`
- `no_claim_of_applied_change`

### Important distinction

Validators should not only exist as prose. They should also be modeled as structured records so they can later be used for:

- prompt composition
- automated review
- testing
- safety gates

### Recommendation

A validator should have:

- a machine key
- a human-readable description
- optional severity
- optional audience

## 4. Agent prompt

### Purpose

Defines the role/use case of a specific AI capability.

This is what I previously called prompt-specific identity. It is better named as agent-level identity.

### Examples

- assignment improver
- presentation improver
- revision planner
- conversation title generator

### What belongs here

- what this agent is supposed to do
- feature-specific intent
- specific domain framing for that use case

### What does not belong here

- consultant preferences
- internal kickoff behavior
- external API workflow instructions

## 5. Agent rules

### Purpose

Rules that apply to one agent/use case but are still reusable across contexts for that same agent.

### Examples

- assignment improver should focus on responsibilities, outcomes, and technical contributions
- presentation improver should preserve third-person voice
- title generator must return only a short title
- revision planner should generate concrete actionable work items

### Characteristics

- narrower than base rules
- shared within one capability
- some may be external-safe, some may be internal-only

## 6. Agent validators

### Purpose

Use-case-specific quality gates.

### Examples

- assignment suggestion must remain within one assignment's scope
- presentation output must remain paragraph prose, not bullet points
- title must be 2 to 4 words
- section replacement must return one complete replacement for the whole section

### Recommendation

Like base validators, these should be structured and not only free text.

## 7. Consultant preferences

### Purpose

Capture the consultant's personal preferences for how their CV should read.

This is what the user meant by "personified". It should be modeled separately from agent behavior.

### Examples

- emphasize leadership more than implementation
- prefer a more direct, plainspoken tone
- avoid buzzwords
- highlight architecture and mentoring when relevant
- prefer shorter assignment descriptions

### Important

These are not the same as system rules.

They are soft preferences, not hard constraints by default.

## 8. Consultant rules

### Purpose

Consultant-specific instructions that should influence generation more strongly than a loose preference.

### Examples

- always write the presentation in third person
- avoid mentioning a specific technology unless it already exists in the source
- prefer leadership framing when the source supports it

### Notes

These still must not be able to override base safety rules.

They should sit below hard system constraints and above stylistic defaults.

## 9. Consultant validators

### Purpose

Checks that verify whether the output respects consultant-level expectations.

### Examples

- preserved preferred tone
- avoided banned phrasing
- did not overstate seniority beyond source material

### Notes

These may often be advisory rather than hard-reject validators.

## 10. Workflow instructions

### Purpose

Describe how the AI should operate in a specific execution environment.

This layer must be separated from content rules.

### Why

Internal workflow and external workflow are not the same thing.

The external client should not inherit internal chat or orchestration behavior.

### Internal workflow examples

- kickoff behavior
- continue in the same branch session
- pending work item sequencing
- use these tools in this order
- do not ask for more changes while work items are pending

### External workflow examples

- fetch context endpoint first
- use PAT auth
- create revision branch before editing
- submit changes through public API
- commit after a set of related edits

### Rule

Workflow instructions should never be stored as generic shared prompt rules unless they are truly shared between internal and external clients.

## 11. Context payload

### Purpose

Provide the concrete data being edited or reviewed.

### Important principle

Context must be rich enough for the use case.

For assignments, do not provide only the raw text if the agent needs the whole assignment.

### Assignment context should include, at minimum

- assignment id
- role
- client name
- description
- start date
- end date
- is current
- keywords
- possibly surrounding resume language or consultant title

### Presentation context may include

- presentation text
- consultant title
- resume language
- consultant summary context

### Why this matters

If we only pass flat text, the AI loses structure and makes worse edits.

## 12. Output contract

### Purpose

Define exactly what kind of output the AI should produce.

### Examples

- plain improved text
- one complete section replacement
- structured JSON suggestion
- tool call payload
- short title string only

### Why this must be separate

Output formatting is not the same as behavior rules or workflow rules.

It should be modeled explicitly so that different clients can consume the same agent differently if needed.

## Recommended precedence model

When these layers interact, precedence should be explicit.

Suggested order:

1. Output contract
2. Workflow instructions
3. Base validators
4. Agent validators
5. Consultant validators
6. Base rules
7. Agent rules
8. Consultant rules/preferences
9. Base prompt
10. Agent prompt
11. Context payload

This is not literal string concatenation order. It is conflict-resolution priority.

### Key principle

Consultant preferences must never override safety or factuality rules.

## Recommended data model

We should not store everything in one table.

## A. Prompt/agent tables

These define reusable AI capabilities.

### `ai_agents`

- `id`
- `key`
- `title`
- `description`
- `audience`
- `sort_order`

### `ai_agent_fragments`

Used for agent-local prompt fragments.

- `id`
- `agent_id`
- `key`
- `label`
- `content`
- `fragment_type`
- `audience`
- `sort_order`

Suggested `fragment_type` values:

- `base_prompt`
- `agent_prompt`
- `output_contract`
- `workflow_instruction`
- `user_template`

## B. Rule tables

### `ai_rule_categories`

- `id`
- `key`
- `title`
- `description`
- `sort_order`

### `ai_rules`

- `id`
- `category_id`
- `key`
- `title`
- `content`
- `rule_kind`
- `audience`
- `severity`
- `is_editable`
- `sort_order`

Suggested `rule_kind` values:

- `rule`
- `validator`
- `preference`

Suggested `audience` values:

- `shared`
- `internal_only`
- `external_only`

Suggested `severity` values:

- `hard`
- `soft`
- `advisory`

### `ai_agent_rule_links`

- `id`
- `agent_id`
- `rule_id`
- `sort_order`

This lets each agent reuse rules in a specific order.

## C. Consultant preference tables

### `consultant_ai_preferences`

- `id`
- `consultant_id`
- `key`
- `title`
- `content`
- `preference_kind`
- `sort_order`
- `created_at`
- `updated_at`

Suggested `preference_kind` values:

- `prompt`
- `rule`
- `validator`

These should be applied as consultant-level overlays, not merged into the base shared rule catalog.

## D. Workflow guide tables

If we want workflow to be editable and explicit, it should have its own tables instead of being hidden in prompt fragments.

### `ai_workflow_guides`

- `id`
- `key`
- `title`
- `audience`
- `description`
- `sort_order`

### `ai_workflow_steps`

- `id`
- `workflow_guide_id`
- `key`
- `title`
- `content`
- `sort_order`

This is especially useful for external clients, where workflow should be explicit but separate from the prompt itself.

## What should be external-safe

These should be eligible for the external context endpoint:

- shared base rules
- external-only workflow guidance
- shared agent rules that are not UI-specific
- external-safe output contracts
- public API tool guides

## What should remain internal-only

These should never be exposed externally:

- kickoff messages
- auto-start prompts
- branch/session continuation prompts
- internal retry/enforcement text
- internal sequencing logic for work-item queues
- frontend-specific coaching copy

## Recommended assembly pipeline

When constructing a final AI request, the system should:

1. Resolve agent
2. Load shared rules and validators linked to that agent
3. Load audience-appropriate workflow instructions
4. Load consultant preference overlays if applicable
5. Load prompt fragments for the current client and use case
6. Inject structured context payload
7. Apply output contract

This should happen differently for internal and external clients.

### Internal client assembly

- includes internal workflow instructions
- may include kickoff fragments
- may include branch/session orchestration

### External client assembly

- excludes internal-only fragments and rules
- includes external workflow guide
- includes shared rules and external-safe agent rules
- relies on context endpoint plus API tool catalog

## What changes compared to the previous document

The earlier design focused mainly on:

- reusable rules
- prompt fragments
- internal-only vs external-safe exposure

This document expands that model by explicitly separating:

- agent identity from consultant preference
- rules from validators
- shared instruction layers from workflow layers
- prompt fragments from workflow guides

That makes the architecture more accurate and more future-proof.

## Concrete classification of current content

### Likely candidates for base rules

- Write in the same language as the source text
- Stay within the requested scope
- Do not invent details
- Be concise and professional
- Do not claim edits are applied

### Likely candidates for agent rules

- assignment improvements should emphasize outcomes and responsibilities
- presentation text should remain paragraph prose
- title generation should be short and punctuation-free
- section replacements should be complete, not partial

### Likely candidates for consultant preferences

- emphasize leadership
- prefer shorter assignment summaries
- avoid certain phrasing
- prefer architecture framing when supported

### Likely internal workflow content

- kickoff_message
- auto_start_message
- pending-work-item orchestration prompts
- internal tool sequencing prompts

### Likely external workflow content

- fetch context endpoint first
- create branch before editing
- use public API calls only
- commit related changes together

## Final recommendation

Yes, we should break out current internal prompt content into smaller reusable layers.

The target architecture should be:

- base prompt, rules, validators
- agent prompt, rules, validators
- consultant preferences, rules, validators
- workflow instructions
- context payload
- output contract

And the persistence model should reflect that separation.

This is the cleanest way to:

- avoid duplication
- prevent internal workflow leakage
- support external AI safely
- support consultant-specific personalization
- keep internal and external AI aligned on shared core guidance
