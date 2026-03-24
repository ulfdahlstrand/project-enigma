# Full CV Revision Workflow

## Purpose

Build a feature that lets a user run a full AI-assisted revision of a CV in a controlled workflow instead of a single freeform chat.

The feature should:

- start with a discussion about what should change in the CV
- let the user and AI agree on the revision direction before rewriting anything
- revise the CV section by section
- provide both the revised result and the reasoning for each part
- guide the user through the process with a checklist/workflow
- let the user discuss and revise each section before moving on
- end with a full revised CV that can be reviewed and saved as a new version

## Core Requirements

### 1. Guided discovery first

The workflow must begin with a discussion phase where the user and AI clarify:

- target role or opportunity
- desired tone and positioning
- strengths to emphasize
- things to remove or downplay
- language and terminology preferences
- seniority and market angle

The AI should not immediately rewrite the whole CV before this phase is complete.

The discovery phase should be modeled as a first-class workflow step (step 0), with its own status and an explicit "agreed" state. The agreed output — target role, tone, emphasis, etc. — must be persisted as structured data, not left only in the chat thread. This is required because every subsequent step uses it as AI context.

### 2. Workflow-based progression

The feature should use a step-based workflow rather than a plain conversation thread.

Each major CV part should become one checklist item. The standard sections are:

- discovery (step 0 — agrees on direction before any rewriting)
- consultant title
- presentation / summary
- skills
- assignments (all assignments reviewed as one section — see design decisions below)
- highlighted experience
- consistency / language polish (final pass)

The checklist is always shown in full. The AI can mark a section as "no changes needed — here is why" but the user still reviews and approves every step explicitly.

Each step should have a clear status:

- `pending` — not yet started
- `generating` — AI is producing a proposal
- `reviewing` — proposal is ready, user is reading or discussing it
- `approved` — user has accepted this section
- `needs_rework` — user has rejected the proposal and discussion continues

### 3. Section-by-section review

For each step:

- the user and AI discuss that specific section
- the AI proposes a revised version of that section
- the AI explains what changed and why
- the user can accept it, revise it, or continue discussing it

The user should not be forced to accept the whole CV at once.

### 4. Structured result per section

For every CV section, the system should store and present:

- original content
- proposed revised content
- change summary
- reasoning
- open questions or assumptions, when relevant

This is required so the user can understand both the output and the rationale behind it.

### 5. Final compiled revision

When all sections are approved, the system produces the final full CV revision.

The final output is the composition of approved step results, with an optional lightweight consistency/language-polish pass as the final checklist step. It is not a new freeform LLM call over the whole CV — that risks reintroducing content the user already rejected in earlier steps.

The final review should include:

- the full revised CV
- a section-by-section explanation of what changed
- the reason for the changes

### 6. Safe apply flow

The result should be saved as a new version or branch of the resume rather than silently overwriting the current content.

### 7. Resumeability

A workflow can be closed and reopened at any point. When the user returns, the checklist reflects the last saved state. No work is lost between sessions.

## Open Design Decisions

These points must be resolved before implementation issues are written in detail.

### Discovery output format

The agreed direction from step 0 (target role, tone, emphasis, etc.) needs a concrete schema so it can be reliably passed as AI context in subsequent steps. Should this be free-form JSON stored in the step result, or a typed schema in the contracts package?

Recommendation: typed schema in contracts so the frontend can render it clearly.

### Assignments granularity

A resume can have 10+ assignments. Options:

- one step for all assignments (review framing and consistency across the section)
- one step per assignment

One step per assignment makes the checklist unmanageably long. Recommended: one step for the assignments section as a whole, focusing on tone, framing, and consistency rather than rewriting each assignment individually.

### AI context passing between steps

When the AI revises step N it needs:

- the structured discovery output from step 0
- previously approved sections for consistency

This affects how prompts are built on the backend and has direct cost implications. The prompt-building strategy (what context is included at each step, how it is trimmed if too long) must be decided before implementing the backend step endpoints.

### Final compilation mechanism

The final CV is assembled from the approved step results. The consistency polish step is the last checklist item — it is not a hidden extra LLM call at the end. This must be communicated clearly in the UI.

## Suggested Solution

### Product shape

Implement this as a dedicated full-page workflow experience, not just an extension of the existing AI drawer.

Recommended layout:

- left column: workflow checklist
- center column: current step discussion with AI
- right column: preview or diff for the current section

This gives the user:

- progress visibility
- clear focus on one section at a time
- confidence before applying changes

### High-level flow

1. Start a new CV revision workflow from a resume or branch.
2. Run the discovery conversation (step 0). Agree on direction and persist structured output.
3. The checklist is pre-populated with all standard sections. Move through it one step at a time.
4. For each section: discuss, propose (with reasoning), and approve.
5. When all sections are approved, compile the final revised CV from the approved outputs.
6. Review the full result and save it as a new resume version or branch.

## Why this solution

This workflow model is better than a single-shot full rewrite because it gives:

- more control
- better transparency
- easier iteration
- clearer reasoning
- lower risk of bad large-scale edits

It also matches how users normally review a CV: part by part, with different concerns for different sections.

## Recommended Technical Direction

### Reuse current foundations

The repository already has:

- AI conversation infrastructure
- resume editing flows
- resume branch/version support

That foundation should be reused where practical.

### Add a dedicated workflow domain

Do not model this as only a generic AI conversation.

Instead, add a dedicated workflow layer on top of the existing AI functionality.

New concepts:

- `cv_revision_workflows` — one per revision run, linked to a resume/branch
- `cv_revision_workflow_steps` — one row per checklist step, with status and order
- `cv_revision_messages` — messages per step (step_id links discovery and section steps alike)
- `cv_revision_step_results` — structured output per step (original, proposed, reasoning, change summary)

### Suggested stored data per step

Each step should persist:

- section identifier
- step order
- step status (`pending` | `generating` | `reviewing` | `approved` | `needs_rework`)
- original content
- proposed content
- reasoning
- change summary
- user approval state

### Final output model

The final workflow result should persist:

- full revised CV snapshot (assembled from approved step results)
- reasoning per section
- workflow metadata
- source resume / branch reference

## Recommended Design Principles

### 1. Do not rewrite everything at once

The AI should not produce the final CV immediately after the first prompt.

The system should first agree on direction, then revise section by section, then compile.

### 2. Keep user approval explicit

The user should actively approve each section before the workflow moves on.

### 3. Keep reasoning first-class

Reasoning is not just debug information. It is part of the product requirement and should be rendered clearly in the UI.

### 4. Keep the final apply step safe

Applying the result should create a new version or branch so the original resume remains intact.

### 5. Make the workflow resumable by default

All state lives in the database. Closing the browser loses nothing. The checklist always reflects the current truth.

## Suggested Implementation Issues

Break this feature into the following GitHub issues:

1. **Epic**: Full CV revision workflow
2. **Feature**: Workflow data model and contracts (DB tables, Zod schemas, oRPC types)
3. **Feature**: Backend workflow endpoints (create, list steps, submit message, advance step, compile result)
4. **Feature**: Workflow page and checklist UI (three-column layout, step navigation)
5. **Feature**: Discovery step — conversation and structured output
6. **Feature**: Section step loop — AI proposal, diff view, approve/rework
7. **Feature**: Final compilation and save-as-version integration
8. **Feature**: Tests and polish
