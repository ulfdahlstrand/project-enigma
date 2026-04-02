# Refactor: Split Large Files

**Branch:** `refactor/split-large-files`
**Goal:** Break all files >500 lines into smaller, focused modules.
**Status as of 2026-04-02:** 4 of 7 files done.

---

## Completed ✅

### 1. `SkillsEditor.tsx` (521 lines → 3 files)
- `apps/frontend/src/hooks/useSkillsEditor.ts` — all state, mutations, derived data, handlers
- `apps/frontend/src/components/SkillsAddCategoryForm.tsx` — extracted add-category form
- `apps/frontend/src/components/SkillsEditor.tsx` — pure render layer

### 2. `resume-tools.ts` (528 lines → 3 files)
- `apps/frontend/src/lib/ai-tools/registries/resume-tool-schemas.ts` — Zod schemas, types, normalizers, helpers (`excerpt`, `groupSkills`, `buildInspectResumeResult`)
- `apps/frontend/src/lib/ai-tools/registries/resume-planning-tools.ts` — `createResumePlanningToolRegistry`
- `apps/frontend/src/lib/ai-tools/registries/resume-action-tools.ts` — `createResumeActionToolRegistry`
- **Updated imports in 5 consumer files** (no barrel re-export)

### 3. `AIAssistantChat.tsx` (862 lines → 4 files)
- `apps/frontend/src/components/ai-assistant/ai-message-parsing.ts` — types, constants, parsing utilities
- `apps/frontend/src/components/ai-assistant/AIAssistantMessageBubble.tsx` — `SuggestionCard`, `ToolStatusMessage`, `AssistantMessageContent`, `MessageBubble`
- `apps/frontend/src/hooks/useAIAssistantChat.ts` — hook with all state, refs, effects, handlers
- `apps/frontend/src/components/ai-assistant/AIAssistantChat.tsx` — slim render layer

### 4. `history/index.tsx` (654 lines → 4 files)
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/history-graph-utils.ts` — constants, types, `computeGraphLayout`, coordinate helpers
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/HistoryCommitTable.tsx` — list view table
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/HistoryBranchGraph.tsx` — canvas tree view + tooltips
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/index.tsx` — slim page

---

## Remaining ⏳

### 5. `e2e-handlers.ts` (1306 lines)
**Location:** `apps/backend/src/routes/e2e-handlers.ts`

**Proposed split:**
- `e2e-resume-bootstrap.ts` — resume/assignment bootstrapping handlers (the `bootstrap-revision` endpoint and helpers)
- `e2e-skills-bootstrap.ts` — skills setup helpers
- `e2e-reset.ts` — data reset handler
- `e2e-handlers.ts` — slim router that mounts all sub-handlers

**Key note:** This is a backend file. Check that oRPC/express router patterns are followed. All handlers are test-only (guarded by `NODE_ENV !== "production"`).

### 6. `inline-resume-revision.ts` (1547 lines) + `$id.tsx` (1726 lines) — **do together**
**Locations:**
- `apps/frontend/src/hooks/inline-resume-revision.ts`
- `apps/frontend/src/routes/_authenticated/resumes/$id.tsx`

These two files are tightly coupled — the hook is consumed entirely by the route.

**Proposed split for `inline-resume-revision.ts`:**
- `useRevisionPlan.ts` — state + actions for the revision plan (RevisionPlan CRUD)
- `useRevisionWorkItems.ts` — state + actions for work items
- `useRevisionSuggestions.ts` — state + actions for suggestions, applying/dismissing
- `useRevisionSkills.ts` — skills-specific revision state
- `useInlineResumeRevision.ts` — top-level hook composing the above, keeping the AI conversation wiring

**Proposed split for `$id.tsx`:**
- `ResumeEditToolbar.tsx` — the save/edit/export button bar at the top
- `ResumeAssignmentsSection.tsx` — the assignments panel (list + add)
- `ResumeSkillsSection.tsx` — the skills panel
- `ResumePresentationSection.tsx` — presentation/summary/title editing
- `ResumeRevisionPanel.tsx` — the inline AI revision checklist + AI chat panel
- `$id.tsx` — slim page that fetches data and composes the above sections

**Caution:** `$id.tsx` is the most complex file. Read it fully before splitting. The revision panel state and the "fork branch" flow need careful handling.

---

## Workflow

For each remaining file:
1. Read the full file
2. Identify natural sub-module boundaries (by feature/concern)
3. Write new files
4. Update all import paths in consumers (use `grep -rn "from.*<filename>"` to find them)
5. Delete the old file (if fully replaced) or overwrite it with the slim version
6. Run `npm run typecheck` in `apps/frontend` (or `apps/backend` for backend files)
7. Run `npm test -- --run` in `apps/frontend`
8. Commit with message format: `refactor(<scope>): <description>`
9. Continue to next file

## Verification before PR

```bash
# From repo root:
npm run typecheck   # full monorepo typecheck
npm test -- --run   # all unit tests
```

Then create PR targeting `dev` branch:
```bash
git push -u origin refactor/split-large-files
gh pr create --base dev --title "refactor: split large files into focused modules" --body "..."
```

## Coding conventions (from CLAUDE.md)

- **Styling:** MUI `sx` prop only
- **i18n:** `useTranslation("common")` — no plain string literals as JSX children
- **API calls:** oRPC client + TanStack Query
- **Immutability:** Always return new objects, never mutate in-place
- **File size target:** 200–400 lines typical, 800 max
