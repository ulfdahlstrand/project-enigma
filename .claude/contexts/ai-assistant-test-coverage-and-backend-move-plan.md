## Goal

Strengthen automated test coverage for the AI assistant flow before moving more of the orchestration logic into the backend.

## Current Assessment

We already have partial coverage in both frontend and backend, but not enough for a safe backend-heavy refactor.

### Existing coverage

- Backend unit tests for AI conversations:
  - `apps/backend/src/domains/ai/conversation/create.test.ts`
  - `apps/backend/src/domains/ai/conversation/message.test.ts`
  - `apps/backend/src/domains/ai/conversation/get.test.ts`
  - `apps/backend/src/domains/ai/conversation/close.test.ts`
- Backend integration test for revision planning:
  - `apps/backend/src/integration/revision/ai-planning.integration.test.ts`
- Frontend entrypoint/component tests:
  - `apps/frontend/src/components/__tests__/ImproveDescriptionButton.test.tsx`
  - `apps/frontend/src/auth/auth-context.test.tsx`
  - `apps/frontend/src/routes/_authenticated/resumes/$id_/edit/__tests__/index.test.tsx`
  - `apps/frontend/src/components/revision/inline-revision.test.ts`

### Main gaps

- No focused test coverage for `useAIAssistantChat`.
- No frontend test that verifies the full assistant loop:
  - create conversation
  - send autostart
  - detect tool call
  - execute tool
  - send tool result
  - surface assistant response / suggestion
- No backend integration that exercises the action-stage assistant loop end-to-end.
- No high-confidence test around assistant initialization from the unified `/resumes/$id/edit` route beyond panel open behavior.

## Plan

### Step 1: Frontend hook coverage for `useAIAssistantChat`

Add a focused test file for:

- conversation auto-creation
- autostart message dispatch
- tool-call processing
- guardrail behavior
- automation behavior
- suggestion/apply flow

Target file:

- `apps/frontend/src/hooks/__tests__/useAIAssistantChat.test.tsx`

### Step 2: Backend integration test for assistant tool loop

Add an integration test that covers:

- create conversation
- scripted OpenAI returns tool call
- client submits tool result
- backend stores resulting assistant reply
- final message history is correct

Suggested target:

- `apps/backend/src/integration/revision/ai-actions.integration.test.ts`

### Step 3: Frontend route/integration coverage for unified edit + assistant

Extend `/resumes/$id/edit` tests to verify:

- assistant is not initialized on default edit load
- assistant initializes only when `assistant=true` or when Assistant is clicked
- chat content lifecycle is wired correctly once opened

Primary target:

- `apps/frontend/src/routes/_authenticated/resumes/$id_/edit/__tests__/index.test.tsx`

### Step 4: Reassess backend move

When the above is green:

- identify which assistant orchestration can move to backend safely
- keep UI-only state in frontend
- move deterministic orchestration rules and conversation progression logic first

## Execution Order

1. `useAIAssistantChat` tests
2. backend integration for assistant action loop
3. `/edit` assistant route coverage
4. backend-move design pass
