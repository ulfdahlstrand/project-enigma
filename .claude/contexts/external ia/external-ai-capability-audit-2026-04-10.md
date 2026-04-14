# External AI Capability Audit — 2026-04-10

## Goal

Map the current public API against the external AI epic and identify which parts
of a resume can already be edited safely through the existing API surface, and
which parts still require follow-up work.

This audit is intentionally API-first. It does not assume MCP and it does not
assume frontend-specific AI flows.

## Current State Summary

The current public API already supports a meaningful part of branch/commit-based
resume editing:

- branch creation and listing
- commit creation and listing
- commit compare
- branch finalisation
- branch assignment CRUD
- resume scalar edits on the main resume
- education create/delete/list

The biggest gaps are not in versioning. They are in edit completeness and API
shape for external clients.

## Section-by-Section Capability

### Title

Current support:

- `PATCH /resumes/{id}` via `updateResume`
- included in commit snapshots via `saveResumeVersion`

Notes:

- This is editable today, but the live/main-resume update path is clearer than a
  branch-draft specific path.

### Consultant Title

Current support:

- `PATCH /resumes/{id}` via `updateResume`
- included in commit snapshots via `saveResumeVersion`

Notes:

- Available today.

### Presentation

Current support:

- `PATCH /resumes/{id}` via `updateResume`
- included in commit snapshots via `saveResumeVersion`

Notes:

- Available today.

### Summary

Current support:

- `PATCH /resumes/{id}` via `updateResume`
- included in commit snapshots via `saveResumeVersion`

Notes:

- Available today.

### Highlighted Items

Current support:

- `PATCH /resumes/{id}` via `updateResume`
- included in commit snapshots via `saveResumeVersion`

Notes:

- Available today.

### Assignments

Current support:

- `POST /resume-branches/{branchId}/assignments`
- `PATCH /branch-assignments/{id}`
- `DELETE /branch-assignments/{id}`
- `GET /resume-branches/{branchId}/assignments`

Notes:

- Assignments are already in good shape for external AI.
- The branch-scoped API is explicit and matches the current content model well.

### Skills and Skill Groups

Current support:

- included in commit snapshots via `saveResumeVersion`
- `PATCH /resume-branches/{branchId}/skills`

Assessment:

- The main branch-scoped edit gap is now covered.
- External clients can use a smaller draft-oriented route instead of creating a
  new commit for every skill adjustment.
- Follow-up work may still be useful later if we want more granular operations
  like “rename one skill” instead of replacing the branch skill snapshot.

### Education

Current support before this Step 2 slice:

- `GET /employees/{employeeId}/education`
- `POST /employees/{employeeId}/education`
- `DELETE /employees/{employeeId}/education/{id}`

Gap:

- No update route existed, which forced external clients to replace entries with
  delete/create for simple edits.

Step 2 action:

- Add `PATCH /employees/{employeeId}/education/{id}` via `updateEducation`

### Branch and Commit Lifecycle

Current support:

- list branches
- fork branch
- save commit
- list commits
- get commit
- compare commits
- finalise branch
- delete branch

Assessment:

- This is already a strong foundation for external AI revision flows.

## Priority Gaps

### Resolved in this slice

- Education update support

### Still open after this slice

1. Define which write scopes external AI tokens should receive after Step 1.
2. Clarify whether title/presentation/summary/highlighted items need a clearly
   branch-scoped mutation endpoint, or whether `saveResumeVersion` is enough.

## Recommendation

For the next external AI slice:

1. Keep Step 1 tokens restricted to the context endpoint until write scopes are
   explicitly approved.
2. Open write access in a narrow way around existing branch/commit endpoints.
3. Treat skills/skill groups as the next likely API-shape improvement, not the
   first blocker.
