# Diff Review Dialog Refactor Notes

Date: 2026-03-31

## Problem

The current `DiffReviewDialog` assumes every reviewable change is a simple `string -> string` diff.
That works for plain text fields such as presentation, summary, and assignment descriptions, but it breaks down for structured domains like skills.

For skills:
- group ordering is not a text diff problem
- internal ordering within one group is not a text diff problem
- flattening structured skill data into strings loses the semantics before rendering
- the current "unified" view is tightly coupled to word-diff behavior, which is only correct for text

## Desired Direction

Make `DiffReviewDialog` a generic shell component.

The dialog should own only:
- modal structure
- title
- view mode state such as `side-by-side` and `unified`
- action buttons: apply, keep editing, discard

The actual review rendering should be passed in from outside.

## Proposed Pattern

Use a render-prop or adapter-based design so each domain controls:
- how side-by-side review is rendered
- how unified review is rendered
- how the reviewed value is formatted when the user clicks Apply

Important point:

"Unified view" is a UI mode, not a universal diff algorithm.

That means:
- text can use a word diff
- skill group ordering can use a before/after ranked-group presentation
- internal skill ordering can use a reordered list for a specific group

## Recommended API Shape

Prefer a typed adapter contract over hardcoding special cases inside `DiffReviewDialog`.

Example direction:

```ts
type ReviewRendererArgs<TValue> = {
  value: TValue;
  updateValue: (next: TValue) => void;
};

type ReviewAdapter<TValue, TResult> = {
  renderSideBySide: (args: ReviewRendererArgs<TValue>) => React.ReactNode;
  renderUnified: (args: ReviewRendererArgs<TValue>) => React.ReactNode;
  formatResult: (value: TValue) => TResult;
};

type DiffReviewDialogProps<TValue, TResult> = {
  open: boolean;
  title?: string;
  value: TValue;
  adapter: ReviewAdapter<TValue, TResult>;
  onApply: (result: TResult) => void | Promise<void>;
  onKeepEditing: () => void;
  onDiscard: () => void;
  applyLabel?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
};
```

## Why This Is Better

- `DiffReviewDialog` stays generic
- text review and structured review can coexist cleanly
- each domain defines its own semantics for "side-by-side" and "unified"
- `formatResult` provides a stable output contract for apply/save logic
- the dialog stops forcing structured data into fake strings
- tests can target structured UI instead of brittle blob text

## Data Model Guidance

Do not pass raw backend suggestions directly into the dialog if they are not already review-friendly.

Prefer passing a dedicated view model, for example:
- `TextReviewModel`
- `SkillsGroupOrderReviewModel`
- `SkillsGroupContentsReviewModel`

Then let the adapter:
- render that model
- convert it to a typed apply result through `formatResult`

## Skills-Specific Guidance

At least two distinct skills review adapters are likely needed:

1. `SkillsGroupOrderReviewAdapter`
- side-by-side: original group order vs suggested group order
- unified: ranked before/after order, not text diff

2. `SkillsGroupContentsReviewAdapter`
- side-by-side: original order vs suggested order for one target group
- unified: before/after ranked list inside that group

Avoid treating these as one generic text case.

## Non-Goals

- Do not make the dialog responsible for domain logic
- Do not keep adding one-off `if skills then ...` branches inside the dialog
- Do not assume every "unified" view should share the same diff algorithm

## Recommended Next Step

When implementation starts:

1. Refactor `DiffReviewDialog` into a shell with adapter-driven rendering.
2. Keep the existing text diff as `TextReviewAdapter`.
3. Introduce dedicated adapters for:
   - skills group order
   - skills internal group ordering
4. Migrate inline revision review to use typed review models instead of flattened strings.
