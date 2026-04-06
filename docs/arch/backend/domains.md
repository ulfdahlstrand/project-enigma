# Backend Domains

## Resume Versioning and Revision Domains

The backend owns the application-level resume versioning model:

- resumes have branches, including `main`
- branches have commit history stored in the application database
- compare/history/merge/delete branch operations are backend-owned domain operations

This logic lives primarily under:

- `apps/backend/src/domains/resume/`

Frontend history and compare UIs are clients of this model, not the source of
truth.

### Assignment Identity vs Branch Content

Assignments are intentionally modeled in two layers:

- `assignments`
  employee-owned identity rows with stable IDs
- `branch_assignments`
  branch-scoped editable content for a given assignment identity

This split exists so the same assignment can be tracked across multiple resume
branches with one stable `assignmentId`, while still allowing each branch to
change:

- description text
- ordering
- highlight state
- inclusion/removal

In other words:

- identity belongs to the employee
- representation belongs to the branch

That model supports future diffing, merge logic, and AI revision tracking
without relying on fuzzy text matching.

## AI Conversation and Assistant Orchestration

The backend also owns persisted AI conversations and is the intended home for
deterministic assistant orchestration:

- conversation creation and messaging live under `apps/backend/src/domains/ai/conversation/`
- tool-call parsing and execution increasingly happen on the backend
- revision-planning and revision-action flows are moving from frontend-driven orchestration toward backend-owned loops

## Current Direction

The long-term direction is a conversation-driven assistant model with thinner
frontend orchestration.
