## Goal

Move as much deterministic AI assistant orchestration as possible from the frontend into the backend, while keeping UI-only state in the frontend.

## Current Status

### Done

- Phase 1 is in place:
  - backend tool parsing
  - backend inspect-tool execution
  - backend tool-call loop inside `sendAIMessage`
- Tests exist for:
  - frontend assistant hook
  - backend action-loop integration
  - unified edit-route assistant initialization

### Newly completed in the current step

- `resume-revision-actions` conversations can now start their first internal automation step during `createAIConversation`
- frontend assistant hook now avoids reposting automation/autostart messages that already exist in persisted conversation history
- inline revision now passes the first action-step automation message as kickoff when opening a new action conversation
- backend can now derive the next action-step automation message from persisted conversation history
- backend can now issue one follow-up autostart or guardrail message for `resume-revision-actions` when the assistant responds with plain text instead of a terminal tool call
- frontend no longer dispatches automation/guardrails for `resume-revision-actions`; backend owns that progression
- backend can now issue planning-stage guardrails for `resume-revision-planning` when the assistant replies in plain text before setting a plan
- frontend no longer dispatches planning guardrails for `resume-revision-planning`
- revision chat no longer passes `autoStartMessage`, `automation`, or `guardrail` props from frontend
- `useAIAssistantChat` no longer contains frontend-side autostart/automation/guardrail effects
- revision state (`plan`, `workItems`, `suggestions`) can now be derived from persisted assistant messages instead of client-side write-tool execution
- browser-side tool execution loop has been removed from `useAIAssistantChat`

### Still pending

- decide whether planning kickoff should also be fully backend-orchestrated instead of greeting-first
- move any remaining non-revision automation/guardrail logic into backend
- decide whether generic/non-revision assistant contexts will ever need browser-side tools; if not, the tool registry API can be simplified further

## Current split

### Frontend responsibilities today

The frontend currently owns both UI state and assistant workflow orchestration.

Main file:

- `apps/frontend/src/hooks/useAIAssistantChat.ts`

It currently handles:

- auto-create conversation
- autostart message dispatch
- automation message dispatch
- guardrail reminder dispatch
- tool-call detection from assistant messages
- tool execution in the browser
- tool-result posting back into the conversation
- suggestion extraction and diff-open behavior

Related frontend state:

- `apps/frontend/src/lib/ai-assistant-context.tsx`
- `apps/frontend/src/components/ai-assistant/AIAssistantChat.tsx`

### Backend responsibilities today

The backend already owns:

- conversation creation
- kickoff greeting generation
- message persistence
- OpenAI calls for normal assistant replies
- optional conversation title generation

Main files:

- `apps/backend/src/domains/ai/conversation/create.ts`
- `apps/backend/src/domains/ai/conversation/message.ts`

## Key finding

The biggest backend-move opportunity is not rendering or diff UI.

The biggest opportunity is to move the assistant progression loop out of `useAIAssistantChat`:

1. assistant message arrives
2. detect tool call
3. execute tool
4. append tool result
5. ask model again
6. optionally apply automation / guardrail rules

That logic is deterministic orchestration and does not need to live in React.

## What should stay in frontend

These are UI concerns and should remain in frontend:

- drawer open/close state
- input text field state
- diff dialog open/close state
- applying accepted suggestion into page-local form state
- scroll-to-bottom behavior
- route-driven assistant visibility (`assistant=true`)

## What should move first

### Phase 1: backend assistant turn execution

Introduce a backend-level orchestration function that can process one assistant turn including tool execution.

Suggested shape:

- receive `conversationId`
- read current conversation history
- call model
- if response contains tool call:
  - execute tool on the backend
  - persist tool result as internal user/system message
  - continue loop
- stop when the assistant returns a normal assistant message without a pending tool call

This should live behind the conversation/message domain, not in the route layer.

Possible backend targets:

- `apps/backend/src/domains/ai/conversation/message.ts`
- or a new module:
  - `apps/backend/src/domains/ai/conversation/orchestrate.ts`

### Phase 2: move automation and guardrails backend-side

The following logic in `useAIAssistantChat` is orchestration, not UI:

- autostart behavior
- automation behavior
- guardrail follow-up messages

These should become backend-side rules, ideally triggered by:

- conversation type / entity type
- tool context metadata
- stage metadata

That avoids frontend timing effects and duplicate-suppression refs.

#### Current status of Phase 2

- revision conversations are partially moved:
  - first action-step kickoff happens in backend `createAIConversation`
  - subsequent action-step automation/guardrail follow-up can now be derived in backend `sendAIMessage`
  - frontend no longer dispatches automation/guardrail for revision conversations
  - frontend no longer executes revision tool calls in the browser
  - revision state is reconstructed from conversation history
- planning guardrails are now backend-owned for `resume-revision-planning`
- planning kickoff is still greeting-first in `createAIConversation`
- generic assistant conversations are not moved yet

### Phase 3: reduce frontend hook to a transport/view hook

After backend orchestration is in place, `useAIAssistantChat` should mostly do:

- load conversation
- send explicit user message
- expose visible messages
- expose suggestion payload
- expose apply/close handlers for UI

At that point:

- tool execution refs can disappear
- autostart refs can disappear
- automation refs can disappear
- guardrail refs can disappear
- `activeToolExecutionCount` can likely disappear or become server-driven status

## Likely API direction

The cleanest direction is to add a backend operation that represents “continue this assistant conversation until a user-visible assistant response is ready”.

Possible options:

### Option A: enhance `sendAIMessage`

Make `sendAIMessage` itself orchestration-aware:

- persist user message
- loop through tool calls internally
- return final visible assistant message

This is the simplest path with minimal surface-area changes.

### Option B: add a new explicit operation

Example:

- `continueAIConversation`

This would separate:

- raw user message append
- orchestrated assistant processing

This is cleaner architecturally, but more invasive.

## Recommendation

Start with Option A.

Reason:

- smallest migration
- existing tests already target `sendAIMessage`
- easier to preserve current frontend contract
- lets us move orchestration incrementally without a UI rewrite

## Concrete migration steps

1. Extract backend orchestration helpers from `sendAIMessage`
   - detect tool calls
   - execute tools
   - build tool result messages
   - loop until visible assistant response

2. Add backend tool execution abstraction
   - backend needs access to the same tool definitions now used in frontend runtime
   - shared tool schemas can stay shared
   - execution should move to a backend-safe runtime

3. Teach `sendAIMessage` to run the orchestration loop
   - for supported assistant contexts first
   - especially revision planning and revision actions

4. Simplify `useAIAssistantChat`
   - remove tool-call processing effect
   - remove autostart/automation/guardrail effects in phases
   - keep only UI behavior

5. Expand tests after each backend shift
   - frontend hook tests should shrink
   - backend integration tests should grow

## Immediate next coding step

The next implementation step should be:

### Continue reducing frontend orchestration without changing UI contracts

Specifically:

- keep `AIAssistantChat` and `useAIAssistantChat` API stable
- continue shrinking `useAIAssistantChat` for `resume-revision-actions`
- next likely move:
  - remove frontend-side `automation` and `guardrail` props from revision chat wiring where backend now owns them
  - decide whether planning-stage assistant should also move to backend kickoff logic
  - then collapse the remaining refs/effects in `useAIAssistantChat`

That keeps the API stable while converging on a backend-owned workflow engine.
