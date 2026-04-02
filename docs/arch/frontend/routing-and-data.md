# Frontend Routing and Data

## Routing

- File-based routing with automatic route codegen (ADR-007).
- Route files live in `src/routes/`.
- The codegen produces `routeTree.gen.ts` which is gitignored.
- Route loaders may pre-fetch data via TanStack Query's `prefetchQuery`.

## Resume Routes

Resume UI has two primary route modes:

- `/resumes/$id` for view mode
- `/resumes/$id/edit` for edit mode

The edit route is the single editing entry point. Manual editing and
assistant-supported editing happen on the same page. Assistant side panels are
hidden by default and only opened on explicit user action.

## Data Fetching

- All server-state is managed via TanStack Query (ADR-007).
- **No direct `fetch` calls.** All backend communication goes through TanStack Query hooks using the oRPC client internally.
- `QueryClient` must be configured at the application root and provided via context.
- Data-fetching logic is co-located with query key definitions for explicit cache invalidation.

## Resume Editing and Assistant UI

Resume editing is branch-aware:

- the frontend can render `main` or a revision branch
- compare/history views operate on app-level resume commits, not Git commits
- assistant-generated revision state is increasingly derived from conversation history rather than mirrored frontend-only workflow state

Important current direction:

- the assistant UI should remain a presentation and review/apply layer
- deterministic orchestration should move to the backend over time
