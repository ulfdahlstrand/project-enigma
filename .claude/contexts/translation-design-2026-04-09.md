# Design: Leaf-Level Translations for the Git-Inspired Content Model

## Decision

Translations belong at the **revision level**, not as branches. A branch represents a structural variant of a CV (different framing, different content emphasis). A translation is the same content in a different language — the tree shape stays identical, only the words change. The branch language acts as a display lens over the tree.

## Proposed Schema

```sql
resume_revision_translations
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  revision_id   uuid        -- logical FK (no constraint — polymorphic)
  revision_type text        -- 'assignment', 'presentation', 'skill', etc.
  language      text        -- 'en', 'sv', etc.
  fields        jsonb       -- translatable fields only, shape varies by type
  created_at    timestamptz DEFAULT now()
  UNIQUE (revision_id, revision_type, language)
```

## Fields shape per revision type

Defined in TypeScript at the application layer, not enforced by the DB:

```typescript
type AssignmentTranslationFields = {
  role?: string;
  description?: string;
  client_name?: string;        // borderline — may not need translation
};

type PresentationTranslationFields = {
  paragraphs?: string[];
};

type SummaryTranslationFields = {
  content?: string;
};

type ConsultantTitleTranslationFields = {
  value?: string;
};

type SkillGroupTranslationFields = {
  name?: string;
};

type SkillTranslationFields = {
  name?: string;
};

type EducationTranslationFields = {
  value?: string;
};
```

Non-translatable fields (never included in `fields`): `technologies[]`, dates, `sort_order`, `is_current`, `assignment_id`, `employee_id`.

## Why not a language column on revision tables

Rejected option: add a `language` column to each revision table so each row is language-specific.

Problem: Swedish revision `r1` and English revision `r2` have no relationship in the model. If the Swedish content is edited (creating `r3`), the English `r2` is silently stale — nothing in the schema signals that re-translation is needed.

With the translations table, staleness is structural: a new revision simply has no translation row yet. The absence is the signal.

Also requires changing `resume_tree_entry_content` PK from `entry_id` to `(entry_id, language)` — a wider structural change.

## Why not JSONB directly on revision tables

Simpler, fewer joins — and functionally equivalent if staleness detection is not needed. The translations table is preferred because:
- Revisions stay immutable — translations are a separate mutable concern
- One migration instead of ~8 (one per revision table)
- Staleness is detectable: check whether a translation row exists for the current `revision_id`

If the staleness signal turns out not to matter in practice, JSONB on each revision table is a valid simpler alternative.

## Read path

The tree resolver already receives the branch language. When resolving a tree entry:
1. Fetch the canonical revision row
2. Look up a translation row for `(revision_id, revision_type, language)`
3. Merge translated fields over the canonical fields — fall back to canonical for any missing field

## Write path

- Save/update a translation row per revision per language
- No new revision is created — translations are independent of revision history
- UI needs a per-item translation editor: show original, allow editing per language

## UI Thoughts and Recommendations

### Framing

Translation is an **editing concern, not a viewing concern.** The CV is authored in its native language (typically Swedish). Translating it is a task done progressively. The output is an export in the target language — not a live toggle. A global language switcher creates a false impression of completeness: if 4 of 12 items aren't translated, switching language makes the CV look broken.

### Translation completeness indicator

Each branch should have a configured set of target languages (e.g. "this CV should also exist in EN"). This enables a completeness metric.

On the resume detail page, show a progress chip per target language: `EN 7/12`. Clicking it filters the view to show only items with missing or stale translations. Don't show translation debt at all until the user has opted a branch into a target language — avoid surfacing noise before it's relevant.

### Per-item editing

When editing any item, show a language tab inside the edit panel:

```
[ Svenska (original) ]  [ English ]
```

The non-native tab shows the original text alongside a translation input field. If the underlying revision was updated after the translation was last saved, show a staleness warning: "original changed — review translation". This makes the staleness signal from the data model visible in the UI.

### Untranslated items in the list

When a branch has a target language configured, show a small badge on item cards that are missing a translation (e.g. a muted `EN` chip). Keep it subtle — it's informational, not an error. Items with a stale translation (original changed after last translated) get a warning-coloured variant of the same badge.

### No global language switcher needed initially

The primary use case is authoring and exporting. A live "view as EN" mode is a nice-to-have but not required for the core translation workflow. Export in the target language is the delivery mechanism — the UI is for building up translations incrementally.

## Open questions before implementation

- Is `client_name` translatable? (Company names are usually kept as-is)
- Which languages are supported — hard-coded list or dynamic?
- Should `highlighted_items.items[]` and `metadata.title` be translatable?
- Staleness UI: how should the frontend signal that a translation may be out of date after a revision change?
