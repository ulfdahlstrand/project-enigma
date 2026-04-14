# AI Prompt Inventory

All locations where AI prompts, system instructions, guidelines, and rules are defined or constructed. Every item in this list is hardcoded in TypeScript — none are DB-backed yet.

---

## Frontend prompt builders

### `apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts`
- `buildAssignmentPrompt()` — system prompt for improving a single assignment description
- `buildAssignmentKickoff()` — opening greeting instruction
- Hardcoded. Language-aware (uses same language as input).

### `apps/frontend/src/components/ai-assistant/lib/build-presentation-prompt.ts`
- `buildPresentationPrompt()` — system prompt for improving the presentation section
- `buildPresentationKickoff()` — opening greeting instruction
- Hardcoded. Third-person narrative, language-aware.

### `apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts`
- `buildUnifiedRevisionPrompt()` — the main system prompt for the unified revision workflow
- `buildUnifiedRevisionKickoff()` — opening greeting
- `buildUnifiedRevisionAutoStart()` — hidden auto-start instruction for resuming work
- Hardcoded. Most complex prompt in the system. Contains:
  - Conciseness rules ("do not narrate your reasoning")
  - Lazy inspection strategy
  - Work item rules ("all concrete actions must become work items first")
  - Scope constraints ("stay within what the user asked for")
  - Suggestion rules ("do not claim changes are applied")
  - Bilingual locale instructions (EN/SV)

---

## Backend prompt builders

### `apps/backend/src/domains/ai/lib/prompts.ts`
- `buildImproveDescriptionPrompt()` — system + user prompt for improving assignment descriptions
- Hardcoded system prompt: expert CV writer, return only the improved text, no preamble
- Uses XML delimiters around user content (prompt injection prevention)

### `apps/backend/src/domains/ai/lib/generate-title.ts`
- Inline system prompt: "You summarise conversations in 2–4 words. Reply with only the summary, no punctuation."
- Used for auto-generating conversation titles
- Model: gpt-4o, max 16 tokens

### `apps/backend/src/domains/ai/conversation/revision-workflow-engine.ts`
- `buildHelpMessage(entityType, language)` — bilingual help text listing capabilities
- `buildExplainMessage(db, input)` — data-driven explanation of what was reviewed and why
- `buildStatusMessage(db, input)` — work item status summary (pending, in progress, completed, etc.)
- `buildPendingWorkItemGuardrailMessage(item)` — guardrail to keep AI focused on one item
- Hardcoded bilingual headers and copy throughout.

### `apps/backend/src/domains/ai/conversation/revision-tools.ts`
- `TOOL_SPECS` array — 11 tool definitions with names and descriptions:
  - `inspect_resume` — return structured resume content for the active revision branch
  - `inspect_resume_sections` — return exact text for all editable sections
  - `inspect_resume_section` — return exact text for one section
  - `inspect_resume_skills` — return exact skills grouping and ordering
  - `list_revision_work_items` — return persisted work items and statuses
  - `list_resume_assignments` — return ordered assignments for the active branch
  - `inspect_assignment` — return exact text for one assignment
  - `set_revision_work_items` — create or replace explicit revision work items
  - `mark_revision_work_item_no_changes_needed` — mark one item as reviewed, no changes
  - `set_assignment_suggestions` — create concrete suggestions for one assignment
  - `set_revision_suggestions` — create concrete suggestions for one or more sections
- Hardcoded inline.

### `apps/backend/src/domains/ai/conversation/action-orchestration.ts`
- `ACTION_GUARDRAIL_MESSAGE` — constant guardrail injected at the action stage:
  - Must use available tools
  - Use the approved plan, do not deviate
  - After inspecting, next response must be a terminal tool call
  - Do not respond with plain text between inspect and terminal call
  - Do not claim changes applied until every work item is handled
- `buildNextWorkItemAutomationMessage(workItems)` — dynamic per-item processing instructions:
  - Broad assignment items: list assignments first, then replace with explicit items
  - Broad skills items: inspect skills structure, create items per group
  - Assignment items: inspect and decide outcome for this item only
  - Section items: inspect source text and decide outcome
- Hardcoded.

### `apps/backend/src/domains/ai/conversation/revision-work-items.ts`
- `buildAutomaticBroadRevisionWorkItems()` — auto-generates work item titles and descriptions for broad revision requests:
  - "Review title"
  - "Review consultant title"
  - "Review presentation"
  - "Review summary"
  - "Review assignment: {clientName}"
- Hardcoded titles and description templates.

---

## Infrastructure and storage

### `packages/contracts/src/ai-conversations.ts`
- Zod schema for `systemPrompt`, `kickoffMessage`, `autoStartMessage`
- System prompts are stored per-conversation in the DB (`ai_conversations.system_prompt`)
- Immutable once stored — the prompt does not change during a conversation

### `apps/frontend/src/lib/ai-assistant-context.tsx`
- `OpenAssistantOptions` interface — receives `systemPrompt`, `kickoffMessage`, `autoStartMessage` from the frontend prompt builders and passes them to the backend on conversation creation

### `apps/backend/src/domains/ai/conversation/message.ts`
- Loads `system_prompt` from the DB conversation record at message-send time
- Builds it into the OpenAI message history as `{ role: "system", content: ... }`
- Detects language from system prompt content
- Enables revision-specific tools conditionally

### `apps/backend/src/domains/ai/conversation/tool-parsing.ts`
- Defines `INTERNAL_AUTOSTART_PREFIX` and `INTERNAL_GUARDRAIL_PREFIX`
- Internal orchestration messages are hidden from the user-visible conversation

---

## Model configuration

All AI calls use `gpt-4o`. Max tokens per call type:
- General messages: 2048
- Conversation creation: 512
- Title generation: 16
- Description improvement: 1024

---

## Key rules appearing across multiple prompts

These are the de-facto "global guidelines" that exist today, scattered across files:

1. Write in the same language as the existing text
2. Stay within the scope of what the user asked for
3. All concrete revision actions must become work items before being executed
4. Do not claim changes are applied — only suggestions are being proposed
5. Inspect the exact source text before proposing changes
6. Do not create extra work items outside the approved plan
7. For full sections, emit exactly one suggestion with complete replacement text
8. Do not narrate reasoning — take the next obvious step immediately
9. Process only one work item at a time (guardrail pattern)
10. Do not ask the user whether they want more changes while pending work items exist
