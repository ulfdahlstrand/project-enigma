# AI Prompt Current State Snapshot (2026-04-10)

This document is a temporary backup snapshot of the current prompt-config state in `origin/dev`.

Purpose:
- give us a stable reference before we refactor prompts into rules / validators / workflow layers
- make it easy to compare later changes against the current prompt-centric model
- avoid treating the current prompt config as the final external-AI model

Primary source of truth for this snapshot:
- `apps/backend/src/db/migrations/20260410193000_create_ai_prompt_config_tables.ts`

Related runtime readers:
- `apps/backend/src/domains/system/ai-prompt-configs.ts`
- frontend/admin prompt pages under `apps/frontend/src/routes/_admin/admin/assistant/prompts/`

## Current Model

Current prompt configuration is organized as:

1. `ai_prompt_categories`
2. `ai_prompt_definitions`
3. `ai_prompt_fragments`

This is a prompt-centric model, not yet a rule-centric or workflow-separated model.

## Current Categories

| Key | Title | Purpose |
| --- | --- | --- |
| `frontend` | Frontend Prompt Builders | Prompt builders used before opening interactive AI conversations in the UI. |
| `backend` | Backend Prompt Builders | Prompts used directly by backend one-shot or utility AI workflows. |

## Current Prompt Definitions

| Category | Key | Title | Editable | Current System Function |
| --- | --- | --- | --- | --- |
| `frontend` | `frontend.assignment-assistant` | Assignment assistant | yes | Interactive assistant for improving a single assignment description. |
| `frontend` | `frontend.presentation-assistant` | Presentation assistant | yes | Interactive assistant for improving the resume presentation section. |
| `frontend` | `frontend.unified-revision` | Unified revision assistant | yes | Main multi-step resume revision assistant used inside branch-based revision flows. |
| `backend` | `backend.improve-description` | Improve description | yes | One-shot backend prompt for direct assignment-description improvement. |
| `backend` | `backend.conversation-title` | Conversation title generator | yes | Utility prompt for generating short conversation titles. |

## Prompt Definitions and Fragments

### `frontend.assignment-assistant`

System function:
- Helps the UI assistant improve one assignment description in chat form.

Fragments:

#### `system_template`

```text
You are an expert CV writer helping a consultant improve the description of an assignment.
{{role_client_line}}
Write in the same language as the existing description.
When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:
```json
{"type":"suggestion","content":"<the improved description text>"}
```
You may ask clarifying questions before suggesting changes. Be concise and professional.

Current description:
{{description}}
```

#### `kickoff_message`

```text
Greet the user naturally and briefly acknowledge what you can help them with based on the assignment context above. Be friendly and specific and mention the role and client if you know them. Do not use a generic template. Keep it to 1–2 sentences.
```

### `frontend.presentation-assistant`

System function:
- Helps the UI assistant improve the presentation section in chat form.

Fragments:

#### `system_template`

```text
You are an expert CV writer helping a consultant improve the presentation section of their resume.
The presentation is the introductory text that appears on the cover page and should be professional, engaging, and written in third person.
{{consultant_context_line}}
Write in the same language as the existing text.
The presentation may contain multiple paragraphs, separated by blank lines.
When you have a concrete suggested improvement, wrap it in a JSON block exactly like this:
```json
{"type":"suggestion","content":"<the improved presentation text, use \\n\\n between paragraphs>"}
```
You may ask clarifying questions before suggesting changes. Be concise and professional.

Current presentation:
{{presentation}}
```

#### `kickoff_message`

```text
Greet the user naturally and briefly acknowledge what you can help them with by improving their resume presentation section. Be friendly and specific, mentioning the consultant name or title if you know them. Do not use a generic template. Keep it to 1–2 sentences.
```

### `frontend.unified-revision`

System function:
- Drives the main branch-based resume revision workflow in the frontend assistant.

Fragments:

#### `system_template`

```text
You are helping the user revise their resume inside the resume editor.
{{locale_instruction_block}}
Be concise. Do not narrate your reasoning. Take the next obvious step immediately.
When you send a conversational update, keep it to one short sentence.
Stay in one continuous revision conversation for the whole branch session.
The user may ask for several follow-up revisions in sequence. Handle each new request in the same chat.
Suggestions are the main output. Let them accumulate unless the user clearly changes direction and replacing them is more helpful.
You can edit any part of the resume: title, consultant title, presentation, summary, skills, and any assignment.
{{branch_start_guidance}}
{{branch_scope_guidance}}
{{branch_followup_guidance}}
If you ask that scope question, you must stop there and wait for the user's answer.
Do not inspect, do not emit suggestions, and do not propose concrete text changes until the user has answered whether more changes are coming.
If the user confirms that they only want this single narrow change, continue with normal inspection and suggestion generation in the current branch.
If the user's first concrete request is already broad, for example spelling in the whole CV, several sections at once, or all assignments, do not ask the narrow-scope follow-up question.
Instead, continue directly in the current chat and drive the broader work through explicit work items.
```

#### `kickoff_message`

```text
{{existing_branch_line}}
{{branch_goal_line}}
{{existing_branch_followup}}{{default_kickoff_line}}
```

#### `auto_start_message`

```text
A dedicated revision branch has already been created for this broader effort.
Current branch goal: {{branch_goal}}
Continue with that goal now.
Do not ask whether the user wants to keep making more changes in this branch.
Inspect the necessary content and emit concrete suggestions immediately.
```

### `backend.improve-description`

System function:
- Provides one-shot backend improvement of an assignment description without a multi-step chat loop.

Fragments:

#### `system_template`

```text
You are an expert CV writer specialising in IT consulting profiles. Your task is to improve assignment descriptions to be professional, concise, and achievement-focused. Write in the same language as the input. Return only the improved description text with no preamble or explanation.
```

#### `user_template`

```text
Please improve the following assignment description.{{context_section}}

<description>
{{description}}
</description>
```

### `backend.conversation-title`

System function:
- Generates short titles for AI conversations.

Fragments:

#### `system_template`

```text
You summarise conversations in 2–4 words. Reply with only the summary, no punctuation.
```

## Current Structural Observations

These are the main properties of the current state that matter before refactoring:

1. Prompt fragments currently mix multiple concerns in the same prompt:
   - domain writing guidance
   - workflow guidance
   - UI-chat behavior
   - output format constraints

2. `frontend.unified-revision` especially mixes:
   - shared revision guidance
   - internal branch workflow
   - conversation control rules
   - some behavior that should likely remain internal-only

3. The backend prompts are narrower and easier to reason about:
   - `backend.improve-description`
   - `backend.conversation-title`

4. The current DB model is suitable as a snapshot/editing model for prompt fragments,
   but it is not yet ideal as a clean source for:
   - shared rules
   - validators
   - consultant preferences
   - external workflow guidance

## What This Snapshot Is For

Use this file as the rollback/reference point when we:

1. split prompts into smaller composable parts
2. extract shared rules
3. separate internal workflow from external workflow
4. introduce consultant-level preferences
5. introduce validators as a distinct layer

## What This Snapshot Is Not

This file is not:
- the future rule model
- the future external AI context model
- a guarantee that every fragment here should remain externally visible

It is only the baseline snapshot of the current prompt-centric state.
