# oRPC REST Route Migration Plan

## Goal

Move the contract from the current mixed API style toward a consistent HTTP model:

- resource reads use `GET`
- normal writes use `POST`, `PATCH`, and `DELETE`
- action-style endpoints remain explicit command routes where REST semantics are weaker

The backend should continue using `OpenAPIHandler`, and the frontend should continue using `OpenAPILink`. The main change is to add explicit `.route({ method, path })` metadata across the contract and align the backend/frontend expectations with that model.

## Current Situation

The repo already supports OpenAPI-style routing:

- backend: `apps/backend/src/app-server.ts`
- frontend: `apps/frontend/src/orpc-client.ts`
- contract: `packages/contracts/src/index.ts`

Some procedures already have explicit REST-like routes, for example:

- `GET /auth/session`
- `POST /ai/conversations`
- `GET /ai/conversations/{conversationId}`

Many others still fall back to procedure-style transport such as:

- `POST /getEmployee`
- `POST /listResumes`

That leads to a mixed API surface which is harder to reason about in logs, browser devtools, caching, and documentation.

## Design Principles

### 1. Reads should use GET where practical

Use `GET` when:

- the operation is a pure read
- inputs can be expressed as path params and query params
- the response is deterministic and cacheable enough to benefit from normal HTTP semantics

Examples:

- `getEmployee` -> `GET /employees/{id}`
- `listEmployees` -> `GET /employees`
- `getResume` -> `GET /resumes/{id}`
- `listResumeBranches` -> `GET /resumes/{resumeId}/branches`

### 2. Normal mutations should use resource-style writes

Use:

- `POST` to create
- `PATCH` to partially update
- `DELETE` to remove

Examples:

- `createEmployee` -> `POST /employees`
- `updateEmployee` -> `PATCH /employees/{id}`
- `deleteEmployee` -> `DELETE /employees/{id}`

### 3. Action endpoints can remain POST

Some operations are commands rather than resource CRUD and should remain explicit actions:

- imports
- exports
- AI chat actions
- branch finalisation
- commit comparison

Examples:

- `parseCvDocx` -> `POST /cv/parse-docx`
- `exportResumePdf` -> `POST /resumes/{resumeId}/export/pdf`
- `compareResumeCommits` -> `POST /resume-commits/compare`

### 4. Keep transport stable

Do not replace oRPC. The existing stack is already capable of exposing proper HTTP methods and paths. The migration should happen by expanding route metadata on the contract, not by replacing the framework.

## Proposed Route Mapping

### Authentication

- `getCurrentSession` -> keep `GET /auth/session`
- `login` / `refresh` / `logout`
  These are currently handled outside the contract. Leave them as-is unless auth is later moved fully into the contract.

### Health and Test

- `health` -> `GET /health`
- `listTestEntries` -> `GET /test-entries`

### Employees

- `listEmployees` -> `GET /employees`
- `getEmployee` -> `GET /employees/{id}`
- `createEmployee` -> `POST /employees`
- `updateEmployee` -> `PATCH /employees/{id}`
- `deleteEmployee` -> `DELETE /employees/{id}`

### Education

- `listEducation` -> `GET /employees/{employeeId}/education`
- `createEducation` -> `POST /employees/{employeeId}/education`
- `deleteEducation` -> `DELETE /education/{id}`

### Resumes

- `listResumes` -> `GET /resumes`
- `getResume` -> `GET /resumes/{id}`
  `branchId` should remain a query param
- `createResume` -> `POST /resumes`
- `updateResume` -> `PATCH /resumes/{id}`
- `deleteResume` -> `DELETE /resumes/{id}`

### Resume Skills

- `createResumeSkill` -> `POST /resumes/{cvId}/skills`
- `updateResumeSkill` -> `PATCH /resume-skills/{id}`
- `deleteResumeSkill` -> `DELETE /resume-skills/{id}`

### Assignments

Ownership needs one explicit decision first:

- if assignments are employee-owned: use `/employees/{employeeId}/assignments`
- if assignments are resume-owned: use `/resumes/{resumeId}/assignments`

Until that is settled, use this as the working proposal:

- `createAssignment` -> `POST /resumes/{resumeId}/assignments`
- `deleteAssignment` -> `DELETE /assignments/{id}`

### Resume Versioning

Reads:

- `getResumeCommit` -> `GET /resume-commits/{commitId}`
- `listResumeCommits` -> `GET /resume-branches/{branchId}/commits`
- `listResumeBranches` -> `GET /resumes/{resumeId}/branches`
- `getResumeBranchHistoryGraph` -> `GET /resumes/{resumeId}/branch-history`

Writes/actions:

- `saveResumeVersion` -> `POST /resume-branches/{branchId}/commits`
- `forkResumeBranch` -> `POST /resume-commits/{fromCommitId}/branches`
  or `POST /resume-branches/fork`
- `finaliseResumeBranch` -> `POST /resume-branches/{revisionBranchId}/finalise`
- `deleteResumeBranch` -> `DELETE /resume-branches/{branchId}`
- `compareResumeCommits` -> `POST /resume-commits/compare`

### Branch Assignments

- `listBranchAssignments` -> `GET /resume-branches/{branchId}/assignment-links`
- `listBranchAssignmentsFull` -> `GET /resume-branches/{branchId}/assignments`
- `addBranchAssignment` -> `POST /resume-branches/{branchId}/assignments`
- `updateBranchAssignment` -> `PATCH /branch-assignments/{id}`
- `removeBranchAssignment` -> `DELETE /branch-assignments/{id}`

### Import / Export

- `importCv` -> `POST /employees/{employeeId}/resumes/import`
- `parseCvDocx` -> `POST /cv/parse-docx`
- `exportResumeMarkdown` -> `POST /resumes/{resumeId}/export/markdown`
- `exportResumePdf` -> `POST /resumes/{resumeId}/export/pdf`
- `exportResumeDocx` -> `POST /resumes/{resumeId}/export/docx`

### AI

Keep these routes explicit and action-oriented:

- `improveDescription` -> keep `POST /ai/improve-description`
- `createAIConversation` -> keep `POST /ai/conversations`
- `sendAIMessage` -> change to `POST /ai/conversations/{conversationId}/messages`
- `getAIConversation` -> keep `GET /ai/conversations/{conversationId}`
- `listAIConversations` -> keep `GET /ai/conversations`
- `closeAIConversation` -> change to `POST /ai/conversations/{conversationId}/close`
  or `PATCH /ai/conversations/{conversationId}`
- `resolveRevisionSuggestion` -> change to `PATCH /ai/conversations/{conversationId}/suggestions/{suggestionId}`

## Migration Strategy

### Phase 1: Inventory and decision cleanup

- confirm assignment ownership model
- confirm branch finalisation route shape
- confirm whether AI close/resolve should be action routes or partial updates

### Phase 2: Add route metadata to the contract

Update `packages/contracts/src/index.ts` so every public procedure has an explicit route unless there is a deliberate reason not to.

Deliverables:

- no more fallback procedure routes for public app APIs
- generated OpenAPI spec reflects intended methods and paths

### Phase 3: Update frontend callers

The frontend already uses `OpenAPILink`, so the main task is to make sure any path/query assumptions still line up with the new contract.

Focus files:

- `apps/frontend/src/orpc-client.ts`
- hooks and route loaders that depend on list/get calls with filters

### Phase 4: Update backend tests and request logging expectations

Things to adjust:

- integration tests that assume `POST /getX`
- request logging assertions if they depend on old procedure paths
- any e2e helpers that call specific paths directly

### Phase 5: Consider compatibility strategy

If this change is rolled out incrementally, decide whether to:

- switch all routes at once, or
- temporarily support old and new paths during migration

Because the frontend and backend live in the same repo, an atomic migration is probably simpler unless external consumers exist.

## Risks

### Breaking path/method assumptions

Frontend, tests, and scripts may implicitly rely on the current generated paths.

### GET payload constraints

Some current read inputs may not map cleanly to path/query params without small schema reshaping.

### Resource modeling gaps

Assignments and some branch/versioning operations need clearer resource ownership before the final route shape is locked in.

## Recommended Order

1. Employees
2. Resumes
3. Education
4. Resume versioning reads
5. Branch assignments
6. AI route cleanup
7. Import/export and other explicit actions

This order gives the fastest improvement to log readability and HTTP semantics while touching the lowest-risk endpoints first.

## Success Criteria

- all obvious reads use `GET`
- CRUD endpoints use `POST`, `PATCH`, and `DELETE`
- action endpoints are explicitly named and intentionally `POST`
- request logs show resource-style paths instead of procedure names
- the OpenAPI spec becomes the canonical API surface instead of a hybrid RPC/REST mix
