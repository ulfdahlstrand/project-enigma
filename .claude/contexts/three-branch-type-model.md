# Design: Three Branch Types — variant / translation / revision

**Status:** Proposed
**Date:** 2026-04-15
**Replaces:** Leaf-level locale tables (`_locale`) — see `../../apps/frontend/.claude/contexts/leaf-language-locale-tables.md` for what was tried first and why we pivoted away.
**Author context:** Conversation between Ulf and Claude, 2026-04-15 afternoon.

---

## 1. Motivation

The previous attempt stored translations at revision-leaf level via parallel `_locale` tables (9 mirror tables for 9 revision tables). This had three fundamental problems:

1. **Schema complexity.** 9 mirror tables, composite primary keys `(revision_id, language)` everywhere, special read paths for locale fallback.
2. **Revision sharing leakage.** Because Git-style revisions are content-addressable and shared across branches after a fork, writing a locale row onto a shared revision affected *all* branches that pointed to it. A fix would have required copy-on-write revision forking — even more complexity.
3. **No natural staleness model.** "Is the English translation up to date with the Swedish source?" required bespoke logic; it didn't fall out of the schema.

The user's insight: **treat translations and work-in-progress changes as what they actually are — branches.** The existing branch/commit infrastructure already models everything we need (divergence, comparison, merging, history). We just need to distinguish what kind of branch a branch is.

## 2. The three branch types

```
branch_type ∈ { 'variant', 'translation', 'revision' }
```

### `variant`
Long-lived, semantic version of the CV. `main` is a variant. "Tech Lead", "Senior Dev", "Startup-focused" are variants. One author typically has a handful.

- Stable — other branch types attach to variants.
- Has a primary `language` (its authoring language).
- Can have zero or more `translation` children (one per target language).
- Can have zero or more `revision` children at any given time (usually short-lived).

### `translation`
A living language version of a `variant`. "Tech Lead-EN" is the English translation of "Tech Lead". Its content is the translated text of its source variant at some point in time.

- Pinned to a source variant via `source_branch_id`.
- Tracks "how far has the translator caught up?" via `source_commit_id` (mutable).
- Staleness is naturally derivable: `source.head_commit_id !== translation.source_commit_id` → the translation is behind.
- Edits happen directly on the translation branch (translator saves a new commit).
- Cannot have its own children. Translations are leaves of the branch tree.

### `revision`
A short-lived working branch. The user's mental model: "I want to accumulate several changes and compare them all against the branch I started from before deciding what to do with them."

- Pinned to a source variant via `source_branch_id`.
- Records the commit it diverged from via `source_commit_id` (immutable).
- Ends its life by one of two transitions:
  - **Merge** — fold changes back into the source variant. Revision is archived.
  - **Promote** — change `branch_type` to `variant`, possibly rename. The revision becomes a standalone variant.
  - *(Discard is also possible — just delete the branch.)*
- Cannot have its own children — revisions don't get their own translations or sub-revisions. Revisions get translated after promotion or merge.

## 3. Hierarchy rules (enforced in DB + UI)

|            | Can have `translation` children? | Can have `revision` children? |
|------------|:-------------------------------:|:------------------------------:|
| `variant`     | ✅ Yes | ✅ Yes |
| `translation` | ❌ No  | ❌ No  |
| `revision`    | ❌ No  | ❌ No  |

Only variants have children. Tree stays shallow (depth 2).

```
CV
├── variant: main (sv)
│   ├── translation: main-en
│   └── translation: main-de
├── variant: Tech Lead (sv)
│   ├── translation: Tech Lead-en
│   └── revision: 2026 rebrand ←── (will eventually merge into Tech Lead or promote to its own variant)
└── variant: Senior Dev (sv)
```

## 4. Schema changes

### New columns on `resume_branches`

```sql
ALTER TABLE resume_branches
  ADD COLUMN branch_type varchar(16) NOT NULL DEFAULT 'variant',
  ADD COLUMN source_branch_id uuid REFERENCES resume_branches(id) ON DELETE RESTRICT,
  ADD COLUMN source_commit_id uuid REFERENCES resume_commits(id) ON DELETE RESTRICT;

ALTER TABLE resume_branches
  ADD CONSTRAINT branch_type_check CHECK (
    branch_type IN ('variant', 'translation', 'revision')
  );

ALTER TABLE resume_branches
  ADD CONSTRAINT branch_source_check CHECK (
    (branch_type = 'variant'    AND source_branch_id IS NULL)
    OR
    (branch_type IN ('translation', 'revision') AND source_branch_id IS NOT NULL)
  );

CREATE INDEX idx_resume_branches_source_branch_id
  ON resume_branches(source_branch_id)
  WHERE source_branch_id IS NOT NULL;
```

### Column semantics

| Column | `variant` | `translation` | `revision` |
|---|---|---|---|
| `source_branch_id` | NULL | The variant it translates | The variant it was forked from |
| `source_commit_id` | NULL | **Mutable** — the source commit the translation is caught up to | **Immutable** — the commit it diverged from |
| `forked_from_commit_id` (existing) | `null` for `main`, set when forked off another variant | Same as `source_commit_id` at creation | Same as `source_commit_id` at creation |
| `is_main` | `true` for main, `false` otherwise | Always `false` | Always `false` |
| `language` | The variant's authoring language | The target translation language | Same as source variant's language |

### What goes away

- `resumes.supported_languages` — **dropped** (already manually dropped in DB cleanup). Which languages a CV supports is now "which translation branches exist under which variants". No column needed.
- `resume_revision_*_locale` tables (all 9) — **already dropped**.
- The `addResumeLocale` handler, `read-tree-content-locale` infrastructure — not cherry-picked; absent on this branch.

## 5. Staleness detection (falls out for free)

For any `translation` branch `T`:
```
stale = T.source_commit_id !== variants[T.source_branch_id].head_commit_id
```

Computed once in the branch-list query with a self-join. No separate staleness tracking.

When staleness is true, UI shows:
```
"Engelska översättningen är 3 commits bakom 'main'. [Visa diff] [Markera som uppdaterad]"
```

"Markera som uppdaterad" = set `T.source_commit_id := variants[T.source_branch_id].head_commit_id`. A single UPDATE.

## 6. Lifecycle transitions

### Creating a translation
**UI flow**: on a variant's page, "+ Lägg till språk" → dialog with language code input → creates a new branch.

```sql
INSERT INTO resume_branches
  (resume_id, name, language, branch_type, source_branch_id, source_commit_id, head_commit_id, forked_from_commit_id)
VALUES
  (<resume_id>, 'main-en', 'en', 'translation', <main.id>, <main.head_commit_id>, <main.head_commit_id>, <main.head_commit_id>);
```

Initially the translation's HEAD points at the same commit as the source — meaning "nothing translated yet, but we know where we are". The translator then makes their own commits; `head_commit_id` advances, `source_commit_id` stays pinned until they mark caught-up.

### Creating a revision
**UI flow**: on a variant's page, "+ Skapa revision" → dialog with name → creates a working branch.

```sql
INSERT INTO resume_branches
  (resume_id, name, language, branch_type, source_branch_id, source_commit_id, head_commit_id, forked_from_commit_id)
VALUES
  (<resume_id>, '2026 rebrand', 'sv', 'revision', <techlead.id>, <techlead.head_commit_id>, <techlead.head_commit_id>, <techlead.head_commit_id>);
```

### Merging a revision into its source variant
**UI flow**: revision page → "Slå samman" button → confirm dialog.

Semantically: source variant's HEAD fast-forwards to revision's HEAD (linear case). If source has advanced, user must rebase first (or we auto-merge — open question).

```sql
UPDATE resume_branches
  SET head_commit_id = <revision.head_commit_id>
  WHERE id = <revision.source_branch_id>;

DELETE FROM resume_branches WHERE id = <revision.id>;
-- or soft-delete; TBD
```

### Promoting a revision to a variant
**UI flow**: revision page → "Gör till egen variant" → dialog for new name → confirm.

```sql
UPDATE resume_branches
  SET branch_type = 'variant',
      source_branch_id = NULL,
      source_commit_id = NULL,
      name = <new_name>
  WHERE id = <revision.id>;
```

`forked_from_commit_id` is retained — it records that this variant was originally forked off commit X.

### Marking a translation as caught up
**UI flow**: staleness banner → "Markera som uppdaterad".

```sql
UPDATE resume_branches
  SET source_commit_id = (SELECT head_commit_id FROM resume_branches WHERE id = <translation.source_branch_id>)
  WHERE id = <translation.id>;
```

## 7. UI implications

### Header layout
```
┌─────────────────────────────────────────────────────────────────┐
│ [Variant: Tech Lead ▼]  [Språk: SV | EN]                        │
│                                          [Pågående revisioner (2) ▾] │
│                                            ├ 2026 rebrand       │
│                                            └ Spotify-ansökan    │
└─────────────────────────────────────────────────────────────────┘
```

- **Variant switcher**: queries `WHERE branch_type = 'variant'`. Same as today's dropdown but with a type filter.
- **Language switcher**: queries `WHERE branch_type = 'translation' AND source_branch_id = <current_variant.id>`. The variant itself is the "default" (its own language). Only renders if there are translations.
- **Revisions menu**: queries `WHERE branch_type = 'revision' AND source_branch_id = <current_variant.id>`. Collapses to a dropdown; shows count.

### On a translation page
Staleness banner (see §5), plus an edit flow that creates commits normally.

### On a revision page
```
┌────────────────────────────────────────────────────────────────┐
│ Du arbetar på revisionen "2026 rebrand" (av Tech Lead)          │
│ [Jämför mot Tech Lead] [Slå samman → Tech Lead] [Gör till variant] │
└────────────────────────────────────────────────────────────────┘
```

### Routing
The cherry-picked `/$locale/…` URL-prefix pattern is UI-chrome language only (which language the app's own strings render in). Branch-type and content-language are orthogonal to the URL prefix. No changes to the routing pattern are needed.

## 8. Migration plan

### Phase 1 — Schema
One migration: `20260416100000_add_branch_type_to_resume_branches.ts`
- Adds the three new columns
- Adds CHECK constraints
- Adds the source_branch_id index
- Backfills: all existing branches get `branch_type = 'variant'`, `source_branch_id = NULL`, `source_commit_id = NULL` (via DEFAULT)

### Phase 2 — Backend
- Update `db/types.ts` with new columns
- Update `listResumeBranches` and `getResumeBranch` to return `branchType`, `sourceBranchId`, `sourceCommitId`, and derived `isStale`
- Update `forkResumeBranch` to accept an optional `{ type: 'translation' | 'revision', language?: string }` parameter — default `'variant'` preserves current behavior
- New mutations:
  - `mergeRevisionIntoSource(branchId)` — fast-forward source to revision's HEAD; delete revision
  - `promoteRevisionToVariant(branchId, newName)` — flip type, clear source fields
  - `markTranslationCaughtUp(branchId)` — update `source_commit_id`
- Contracts: expose all the above in `packages/contracts/src/resumes.ts`

### Phase 3 — Frontend
- Split `VariantSwitcher` into: `VariantSwitcher`, `LanguageSwitcher`, `RevisionsMenu`
- Rewire `ResumeLanguageSwitcher` (cherry-picked) — it currently reads `supportedLanguages` from props; switch to reading translations from the branch list
- Add "Create translation" and "Create revision" flows
- Add revision-page banner with merge/promote actions
- Add translation staleness banner

### Phase 4 — Tests
- Migration tests (static-analysis + integration)
- Backend tests for all new mutations (TDD)
- Frontend component tests for the three switchers + banners

## 9. Open questions to resolve before implementation

1. **Merge semantics**: simple fast-forward only, or do we attempt three-way merge when source advanced? For MVP, **fast-forward only, block merge if source advanced, require user to "rebase" (create a new commit on revision that brings in source changes) first**. Can revisit.
2. **Hard delete or soft delete** when merging/discarding a revision? **Soft delete** (a new `archived_at` column) is safer — preserves history. Proposing: add `archived_at timestamp NULL` now so we don't need a second migration later.
3. **Is `resume_branches.forked_from_commit_id` redundant** now that we have `source_commit_id`? No — they mean different things:
   - `forked_from_commit_id` is the historical divergence point (immutable, informational).
   - `source_commit_id` has type-specific semantics (mutable for translations, same as fork point for revisions).
   Keep both; they're cheap.
4. **Translation of a translation-branch's commit history**: if a translator on main-en makes 5 commits, none of those affect main's source staleness calc (good). But does main-en's history show its own commits (yes) or main's pre-fork history too? **Both** — it's still a branch with `forked_from_commit_id` pointing back, history walker follows parent pointers.
5. **Guardrails in UI**: should we warn when editing a translation that the user "should edit the source instead" if they're trying to change structural things? Probably — but out of scope for initial implementation; add later if it becomes a problem.

## 10. Work on this branch

1. Write migration + test for Phase 1
2. Run migration locally, verify schema
3. Implement Phase 2 (backend) with TDD
4. Implement Phase 3 (frontend) with TDD
5. Integration test via browser
6. PR to dev

## 11. Non-goals

- MCP tools for translation (previously planned as #555, #556). Reconsider design later — will be much simpler in this model since "translate branch" = "create new translation branch and populate its commits".
- Importing/exporting CVs with translations. Existing import/export logic for a single branch still works; a translation branch is just another branch.
- Guarding against malformed branch hierarchies beyond the CHECK constraint. The UI prevents invalid operations; if a user bypasses it, CHECK catches it at DB level.

---

**Ready to start implementing?**
