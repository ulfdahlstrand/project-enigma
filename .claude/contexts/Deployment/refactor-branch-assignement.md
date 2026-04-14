## Improve branch read API: add branch content endpoint and consolidate assignment routes

### Background

The external AI API currently has no direct way to read the full content of a branch. To get the current state of a branch, a client must:

1. `GET /resumes/{resumeId}/branches` — find the branch and its `headCommitId`
2. `GET /resume-commits/{headCommitId}` — fetch the actual content

This two-step pattern is a workaround caused by branches being pure pointers to commits with no content of their own. It puts unnecessary burden on every AI client and forces the context endpoint to document a workaround rather than a clean API contract.

Additionally, all branch-assignment routes today live outside the resource hierarchy:

```
GET    /resume-branches/{branchId}/assignments   ← disconnected
POST   /resume-branches/{branchId}/assignments   ← disconnected
PATCH  /branch-assignments/{id}                  ← disconnected, no resume/branch context in path
DELETE /branch-assignments/{id}                  ← disconnected, no resume/branch context in path
```

This is inconsistent with the rest of the API and makes the resource ownership unclear, especially for the `PATCH` and `DELETE` routes which carry no branch or resume context in the path at all.

### Proposed changes

**1. Add `GET /resumes/{resumeId}/branches/{branchId}`**

A thin wrapper that internally resolves `branch.headCommitId` and returns the full commit content as the branch's current state. No new business logic — purely a read convenience route.

**2. Consolidate all assignment routes under the resource hierarchy**

```
Before:
  GET    /resume-branches/{branchId}/assignments
  POST   /resume-branches/{branchId}/assignments
  PATCH  /branch-assignments/{id}
  DELETE /branch-assignments/{id}

After:
  GET    /resumes/{resumeId}/branches/{branchId}/assignments   ← redundant given (1), remove
  POST   /resumes/{resumeId}/branches/{branchId}/assignments
  PATCH  /resumes/{resumeId}/branches/{branchId}/assignments/{id}
  DELETE /resumes/{resumeId}/branches/{branchId}/assignments/{id}
```

`GET` assignments is still redundant once the full branch endpoint exists and can be omitted entirely.

### Result

```
GET    /resumes/{resumeId}
GET    /resumes/{resumeId}/branches
GET    /resumes/{resumeId}/branches/{branchId}                        ← new
POST   /resumes/{resumeId}/branches/{branchId}/assignments
PATCH  /resumes/{resumeId}/branches/{branchId}/assignments/{id}       ← moved
DELETE /resumes/{resumeId}/branches/{branchId}/assignments/{id}       ← moved
```

All branch and assignment operations now share a consistent, predictable path structure. The external AI context endpoint can describe a clean resource hierarchy without workarounds or disconnected routes.