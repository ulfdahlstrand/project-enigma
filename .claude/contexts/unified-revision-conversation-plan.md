## Goal

Replace the current staged inline revision workflow (`planning -> actions -> finalize`) with a single continuous revision conversation per edit/branch session.

The chat should support multiple user requests in sequence, for example:

1. "jag vill fixa stavfel i presentationen"
2. review/apply suggestions for the presentation
3. "nu vill jag fixa formuleringen i uppdrag XYZ"
4. review/apply suggestions for that assignment

The user should not need to move between separate planning and action phases to continue working.

## Why this change is needed

The current staged model is too rigid for a conversational UX.

Problems with the current model:

- the user gets locked into stage transitions (`planning`, `actions`, `finalize`)
- `Gå till åtgärder` and similar transitions are fragile
- multiple follow-up requests in the same chat feel unnatural
- frontend state is more complex because it tracks workflow phases explicitly
- backend orchestration becomes harder because the domain model is stage-oriented instead of conversation-oriented

The product requirement is simpler:

- the user should be able to ask for help repeatedly in the same conversation
- the assistant should inspect the relevant content
- the assistant should produce suggestions
- the user should review/apply/dismiss suggestions
- branch isolation and final merge should still work

## Target model

### Primary objects

The core flow should revolve around:

- one revision conversation
- one suggestion list
- optional derived task/checklist UI

The conversation is primary.
Suggestions are the main output.

Any checklist/task grouping should be a derived UI convenience, not the workflow engine.

### What disappears

- separate planning conversation
- separate action conversation
- explicit `planning` / `actions` stage transitions
- `Gå till åtgärder`
- `openActions()` as a workflow pivot
- pending-action-branch state whose only job is to bridge planning -> actions

### What remains

- revision branch creation / usage
- assistant conversation scoped to the branch/session
- suggestion review/apply/dismiss
- finalize / merge / keep branch
- branch history and compare

## UX target

### On `/resumes/$id/edit?assistant=true`

The assistant opens in one unified mode.

The user can:

- ask for one correction
- ask for several corrections over time
- switch focus from presentation to summary to assignment to skills in the same chat

The assistant should:

- inspect only what is needed for the new request
- produce suggestions directly
- optionally ask clarification questions when needed
- keep the existing branch/session context

### Suggestion behavior

Suggestions should accumulate in the current session unless explicitly cleared.

Each suggestion should still support:

- `pending`
- `accepted`
- `dismissed`

The left-side panel can still show:

- proposed revisions
- reviewed revisions
- maybe grouped by section

But it should not require a separate planning phase.

## Backend direction

This new model fits the backend orchestration work already underway.

### Preferred backend responsibility

The backend should own:

- deciding when to inspect resume content
- generating tool calls
- executing the loop until a user-visible assistant reply is ready
- producing suggestion messages
- optionally tagging messages/suggestions with section/assignment metadata

### Frontend responsibility

The frontend should own:

- rendering conversation messages
- rendering suggestions
- review/apply/dismiss actions
- local draft state for accepted changes
- branch/finalize UI

## Suggested implementation plan

### Phase 1: unify conversation ownership

- stop thinking in separate planning/action conversations
- use one assistant conversation per revision branch/session
- update routing and assistant context so revision chat stays attached to that one conversation

Expected result:

- follow-up prompts stay in the same chat
- no branch-local workflow handoff between planning and actions

### Phase 2: replace stage state with derived UI state

Current frontend state includes:

- `stage`
- `plan`
- `workItems`
- `pendingActionBranchId`

This should move toward:

- `suggestions`
- optional derived checklist/task grouping from conversation history
- `isFinalizing`

Possible target:

- derive section/task summaries from tool-call messages in conversation history
- do not store a separate planning graph in React unless the UI truly needs it

### Phase 3: simplify checklist UI

The left panel should be redefined as something like:

- `Conversation summary`
- `Suggested revisions`
- `Reviewed revisions`

Optional:

- grouped by section
- grouped by assignment

But not:

- plan first
- then actions
- then finalize

### Phase 4: update prompts/tools

The revision prompts should stop assuming a mandatory staged flow.

Instead, the assistant should be told:

- inspect only the content needed for the current user request
- emit concrete suggestions directly when enough context exists
- ask follow-up questions only when truly required
- avoid building large intermediate worklists unless they add real value

This likely means reducing the centrality of:

- `set_revision_plan`
- `set_revision_work_items`

and relying more on:

- inspection tools
- `set_revision_suggestions`
- `set_assignment_suggestions`
- no-change outcomes

### Phase 5: finalize as separate UI capability

Finalization should remain possible, but it should be independent of chat staging.

The user should be able to:

- review accepted/pending suggestions
- save manual edits
- merge branch
- keep branch

without needing the assistant to enter a `finalize` phase first.

## Technical consequences

### Files likely to change the most

- `apps/frontend/src/hooks/inline-resume-revision.ts`
- `apps/frontend/src/hooks/inline-revision/use-inline-revision-assistant.ts`
- `apps/frontend/src/components/revision/InlineRevisionChecklist.tsx`
- `apps/frontend/src/components/resume-detail/ResumeEditWorkspace.tsx`
- `apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts`
- backend conversation orchestration modules under:
  - `apps/backend/src/domains/ai/conversation/`

### Likely deletions

- explicit action-opening transition logic
- `pendingActionBranchId`
- stage-specific assistant routing for planning vs actions
- stage-coupled helper logic that only exists to bridge one phase into another

## Testing implications

We should replace stage-transition tests with conversation-flow tests.

New ideal tests:

1. user asks to fix presentation spelling
2. assistant produces presentation suggestions
3. user accepts/dismisses
4. user asks to improve wording in one assignment
5. assistant produces assignment suggestions in the same conversation
6. suggestion list and branch state remain coherent throughout

Important:

- test repeated requests in the same chat
- test mixed manual edits + assistant suggestions
- test that accepted suggestions still persist correctly on the branch

## Recommendation

Do not keep the current staged model just because it already exists.

The simpler and more robust direction is:

- one revision chat
- suggestions as the main output
- optional derived checklist
- finalize as separate UI, not a chat stage

This is both a better UX and a better fit for the backend-oriented architecture we are moving toward.
