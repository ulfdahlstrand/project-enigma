# Design: One Resume Per Language, Linked via Tags

**Status:** Proposed
**Date:** 2026-04-17
**Supersedes:** `./three-branch-type-model.md` (2026-04-15) — "translation" as a branch type.
**Author context:** Conversation between Ulf and Claude, 2026-04-17 morning.

---

## 1. Context — why we're changing direction

The three-branch-type model (2026-04-15) introduced `translation` as a branch type with special semantics: a translation branch lives inside the same resume as its source variant, pinned via `source_branch_id` / `source_commit_id`, with bespoke staleness rules.

After building against it, the translation flow feels stökigt:

- Language is treated as a first-class attribute of branches, so sidebar, graph, commit table, and filter logic all have language-specific code paths.
- Filtering "översättningar" vs "sv"/"en" was lifted to the parent route in a recent pass (good), but the branch view components still need to understand that some branches are translations of others in the same tree.
- Mental model is awkward: a translation is structurally a branch, but humans think of it as "the English version of the CV" — a separate document, not a sub-branch.

Ulf's insight: **treat each language as its own resume.** A consultant has multiple resumes (different variants, different languages). Each resume is single-language. Branches inside a resume are language-agnostic — they only model structural versioning. Cross-language correspondence ("the English version is caught up to the Swedish version as of commit X") is expressed by **tags** that link commits across resumes.

This collapses a whole axis of special-casing. Branches become simpler. The "översättningar"-filter still works, but now means "branches in this resume that have a cross-language tag", and clicking the language indicator becomes **navigation to the other resume** instead of a variant-switch within the same tree.

## 2. Model

### Entities

```
Consultant (employee) 1───N Resume 1───N Branch 1───N Commit
                                                         │
                                                         ↓
                                                     CommitTag (cross-resume link)
```

- **Resume** has a single `language` (e.g. `sv`, `en`).
- **Branch** lives inside a single resume. Has a name, head commit, and parent-branch history (unchanged from today's structure). **No `language` on branch.**
- **Commit** lives inside a branch. Content-addressable as today.
- **CommitTag** (new): a directed link between two commits in two *different-language* resumes. Semantically: "commit A in resume R1 corresponds to commit B in resume R2".

### CommitTag semantics

A tag is the cross-resume equivalent of "the English translation is caught up to this Swedish commit". It has:

- `source_commit_id` — the commit in the authoring-language resume
- `target_commit_id` — the commit in the other-language resume that corresponds
- `kind` — `'translation'` for MVP (future: `'derived-from'`, `'port-of'`)

**Staleness** for a target resume R2 relative to its source R1:
```
R1_head = head of the branch in R1 that the latest tag was made against
R2_head = head of the corresponding branch in R2
stale   = (latest tag's source_commit_id) ≠ R1_head
```

"Mark as caught up" = create a new tag with the current R1 head and the current R2 head.

### What this replaces

- No more `branch_type = 'translation'`. Translations are separate resumes.
- No more `source_branch_id`/`source_commit_id` on branches for translation purposes.
- Branch type reduces to two: `variant` and `revision` (revisions still make sense — short-lived working branches inside a single-language resume). Actually: we may not even need a `branch_type` column initially; see §4 step 1.

## 3. UX (preserves today's feel)

### Tree / graph / sidebar
- Still shows all branches of the current resume.
- A branch that has outgoing tags to another-language resume shows a **language-link indicator** (e.g. a small "EN →" badge). Same visual affordance as today's translation indicator, different meaning.
- Filter chips:
  - **"Översättningar"** → branches with at least one commit that has a cross-language tag.
  - **"SV" / "EN"** → branches with at least one tag pointing to a resume in that language (or "this is an SV resume" — TBD).
- Filtering is done in the parent route (already the case); components stay dumb.

### Clicking the language indicator
- Navigates to the linked resume and positions on the tagged commit (deep link).
- This replaces today's "växla variant inom samma branch" behavior.

### Staleness banner
- On a resume that is tagged as the translation of another, show:
  > "Engelska versionen är 3 commits bakom svenska huvudversionen. [Visa diff] [Markera som uppdaterad]"
- "Markera som uppdaterad" creates a new CommitTag with current heads.

### Consultant overview
- New affordance (or extend existing): a consultant's resume list groups "same variant, different language" via tag relationships. MVP: a simple "detta CV har en engelsk motsvarighet" link on the resume page is enough.

## 4. Two-step rollout

Ulf's constraint: **don't over-engineer step 1.** The DB shouldn't change much — we essentially just add tags. Everything else is code organization.

### Step 1 — build the flow on top of near-current schema

DB changes (minimal):
- Add `commit_tags` table:
  ```
  commit_tags (
    id uuid pk,
    source_commit_id uuid fk -> resume_commits(id),
    target_commit_id uuid fk -> resume_commits(id),
    kind varchar(32) not null default 'translation',
    created_at timestamp not null,
    created_by uuid fk -> employees(id) null,
    unique (source_commit_id, target_commit_id, kind)
  );
  create index idx_commit_tags_source on commit_tags(source_commit_id);
  create index idx_commit_tags_target on commit_tags(target_commit_id);
  ```
- `resumes.language` — ensure it exists (add if missing). This is the language of the resume as a whole.
- **No changes** to `resume_branches`: we stop using language-related columns/logic, but don't drop them yet. (If `branch_type = 'translation'` exists on some rows from earlier prototyping, we leave them alone in step 1.)

Backend:
- New oRPC procedures in `packages/contracts/src/resumes.ts` (or equivalent):
  - `listCommitTags({ resumeId })` — tags where source or target commits live in this resume, joined with linked-resume metadata (id, language, name). Used to render link indicators.
  - `createCommitTag({ sourceCommitId, targetCommitId, kind })`
  - `deleteCommitTag({ id })`
  - `getTranslationStatus({ resumeId, targetResumeId })` — returns latest tag + staleness flag.
- Extend `listResumeBranches` / tree queries to include a per-commit tag summary so the sidebar/graph can render indicators without N+1 fetches.

Frontend:
- Components stay dumb — they receive pre-filtered branches + a `commitTags` map (`commitId → TagInfo[]`) from the parent route.
- Parent route owns the language filter state; it computes visible branches and passes them down.
- Replace the "variant switch on language click" with `navigate(/$locale/resumes/<linkedResumeId>#<linkedCommitId>)`.
- Add a "Skapa översättning" flow: creates a new resume (cloned content, language switched) + an initial CommitTag.
- Add a "Markera som uppdaterad" action on the staleness banner.

### Step 2 — clean up (only after UX is validated)

- If `resume_branches` has language/translation-type columns from earlier experiments, drop them in a new migration.
- If `branch_type` still exists, collapse to `{ variant, revision }` or remove entirely.
- Consolidate any remaining language-on-branch code paths.
- Data migration: for any consultant who has a "translation branch" of an existing resume, materialize it as a separate resume + CommitTag. (Script, runnable once.)

## 5. Key files (for implementation in step 1)

Schema:
- `apps/backend/src/db/migrations/` — new migration `YYYYMMDDHHMMSS_add_commit_tags.ts`.
- `apps/backend/src/db/types.ts` — add `CommitTagTable`.

Backend:
- `packages/contracts/src/resumes.ts` (new or extend) — Zod schemas + oRPC procedures for the tag API.
- `apps/backend/src/router.ts` — wire procedures.
- Handler file for tags (e.g. `apps/backend/src/handlers/commit-tags.ts`).

Frontend:
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/index.tsx` — owns filter state; passes filtered data + tag map down.
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/HistoryBranchSidebar.tsx` — render language-link indicator from tag map.
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/HistoryCommitTable.tsx` — same.
- `apps/frontend/src/routes/_authenticated/resumes/$id_/history/HistoryBranchFilters.tsx` — filter definitions (översättningar, sv, en) already here; re-point their semantics to use tags.
- New components: `CreateTranslationDialog.tsx`, `TranslationStalenessBanner.tsx`, `LanguageLinkBadge.tsx`.

Tests:
- Migration test for `commit_tags`.
- oRPC handler tests for create/list/delete tag + getTranslationStatus.
- Component tests: filter logic, dumb rendering of indicators, staleness banner.
- E2E happy path: create sv resume → add en translation → edit sv → see staleness on en → mark caught up.

## 6. Verification

- Unit: migration round-trips; handler unit tests for tag CRUD and staleness.
- Integration: create two resumes with tags, verify `listCommitTags` returns correct joined data, verify navigation from sv → en preserves commit anchor.
- Manual E2E (browser): the "översättningar" filter in the history view shows only branches with cross-language tags; clicking the EN indicator navigates to the en resume; editing sv after tagging produces a staleness banner on en; "Markera som uppdaterad" clears it.
- Regression: branches without any tags render exactly as single-resume branches would today (no language special-casing visible).

## 7. Open questions

1. **`resumes.language` naming**: does such a column exist today, or do we add it fresh? (Three-branch-type doc mentions `resumes.supported_languages` was dropped; need to confirm current state.)
2. **Tag direction**: source→target or bidirectional? Proposal: unidirectional with `kind='translation'`; if needed later, two tags express mutual correspondence.
3. **Per-branch or per-commit tags?** Proposal: per-commit. A tag pins specific commits on both sides; branch-level is derivable ("branch X has a tag" = "any commit on branch X has a tag").
4. **Cloning content when creating a translation**: full snapshot copy? Initial commit points at cloned content? Or empty target resume that the translator fills in? Proposal: copy source content verbatim as the first commit on the new resume; translator edits from there.
5. **Consultant-level "these resumes belong together" grouping**: do we need a `resume_group_id` for UX grouping, or is "connected by tags" enough? Proposal: tags only for MVP. Revisit if the resume list feels chaotic.

## 8. Non-goals (step 1)

- Migrating existing three-branch-type data. Step 2 territory.
- Dropping any columns on `resume_branches`. Step 2.
- MCP tools for creating translations programmatically.
- Multi-language UI chrome (orthogonal; already handled via `/$locale/` routing).

## 9. Next actions

1. Mark `./three-branch-type-model.md` as superseded (header update only, don't delete — useful history).
2. Spin up step 1 implementation: migration first (TDD), then backend, then frontend rewire.
