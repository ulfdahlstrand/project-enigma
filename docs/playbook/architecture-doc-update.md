# Recipe: Adopting a New Frontend Library — Architecture Documentation

## When to Use

When an epic or feature introduces a new frontend dependency (component library,
utility library, icon set, etc.) that is not yet recorded in `architecture.md` or
`tech-decisions.md`. The architecture documentation **must** be updated before
any implementation tasks for that epic can be approved.

---

## Context / Background

Every new runtime dependency needs a formal record in three places:

1. **`docs/tech-decisions.md`** — an ADR explaining the _why_: context, alternatives
   considered, decision made, and consequences.
2. **`docs/architecture.md`** (index) — a new row in the Tech Stack summary table.
3. **`docs/arch/frontend.md`** (or the relevant domain sub-document) — usage
   rules, file locations, and any patterns that downstream implementation tasks
   must follow.

This sequencing matters: implementation tasks are blocked until these documents
exist, because the Architect uses them to decide whether a PR is architecturally
conformant.

**Key precedent — ADR-008 (Material UI, task #29):**  
MUI was introduced via an architecture-only task that added ADR-008, updated the
Tech Stack table, added a `components/layout/` directory to the canonical
structure, added two `Directory Responsibilities` entries, and added a numbered
Key Pattern. This was completed entirely within `docs/` — no application code
was touched.

---

## Steps

### 1. Determine the next ADR number

Open `docs/tech-decisions.md`. Find the last `ADR-NNN` heading and increment by 1.
The numbering must be **strictly sequential** — do not skip or reuse numbers.

### 2. Write the ADR in `docs/tech-decisions.md`

Append a new section at the **bottom** of `docs/tech-decisions.md` (file is
append-only). Use the template in the file header. The ADR must cover:

- **Context** — why the library is needed; alternatives considered and why they
  were rejected.
- **Decision** — what was chosen; key aspects (mandatory setup, naming
  conventions, exclusivity constraints).
- **Consequences** — which `package.json` files gain a new dependency; what is
  now forbidden (e.g. raw CSS files, alternative libraries); any downstream
  impact.

For a component/UI library, the Decision section must specify:
- Whether it is the _sole_ library of its kind (no competitors allowed).
- Mandatory provider/wrapper components and where they must be rendered.
- The primary styling mechanism.
- Which MUI (or equivalent) components are standard primitives.
- Where theme/config files live (`src/lib/<name>.ts` pattern).

### 3. Update the Tech Stack summary table in `docs/architecture.md`

Add a new row to the **Tech Stack (Summary)** table in `architecture.md`.
Row format:

```
| <Layer label>         | **<Library name>**       | <One-line usage note. See ADR-NNN.> |
```

Example:
```
| Frontend component library | **Material UI** | ThemeProvider + CssBaseline at app root; sx prop for styling. See ADR-008. |
```

Do **not** modify any other section of `architecture.md` unless the task
explicitly requires it. The index file is intentionally minimal.

### 4. Update the relevant domain sub-document

Open `docs/arch/frontend.md` (or the appropriate domain file from the sub-document
index in `architecture.md`).

Make the following additions as needed:

**a) Tech Stack table row** — Add a row for the new library.

**b) Directory structure** — If the library introduces new canonical directories
(e.g. `components/layout/`, `src/lib/theme.ts`), add them to the directory tree
diagram.

**c) Directory Responsibilities** — Add a bullet (or new subsection) describing
what lives in each new directory. Match the style of existing entries.

**d) Usage rules section** — Add a named section (e.g. `## Material UI —
Component and Styling Rules`) documenting:
- Mandatory setup (providers, wrappers, config file).
- Permitted and forbidden patterns.
- Standard primitive components.

### 5. Update Key Patterns in `docs/arch/frontend.md` (if applicable)

If the library introduces a cross-cutting constraint (e.g. "no raw CSS files"),
add a numbered **Key Pattern** entry. Key Patterns are numbered sequentially;
find the last pattern number and increment. Example from ADR-008:

> **Pattern #9: Material UI as the Sole Styling and Component System**  
> No raw CSS files (`.css`, `.scss`), inline `style` objects, or standalone
> Emotion `styled()` calls where MUI's `sx` prop or theme covers the need.
> `ThemeProvider` + `CssBaseline` must be rendered at the app root.

### 6. Verify the diff touches only `docs/`

This is a documentation-only task. Running `git diff --name-only` should show
only files under `docs/`. Any change to `apps/`, `packages/`, `docker/`, or root
config files is out of scope and must be done in a separate implementation task.

### 7. Open a PR with a descriptive title

Title format: `[#<issue-id>] Record <Library Name> in architecture documentation`

The PR body should list every file changed and every section updated so the
Architect can efficiently verify conformance.

---

## Gotchas

- **ADR numbers must be sequential.** There is no auto-increment. Always check
  the last ADR number before writing the new one. Duplicates or gaps will cause
  confusion and must be corrected via a follow-up task (you cannot edit past ADRs).

- **`architecture.md` is the index, not the detail file.** Most content belongs
  in `docs/arch/<domain>.md`. Only the summary Tech Stack table row and the
  monorepo structure diagram go in `architecture.md`.

- **Do not add implementation code in an architecture task.** Even if the library
  is already installed locally, a documentation-only task must not touch
  `package.json`, `package-lock.json`, or any source file. The installation
  belongs in the first implementation task that actually uses the library.

- **Key Patterns live in `docs/arch/frontend.md`, not in `architecture.md`.**
  The index file (`architecture.md`) lost its Key Patterns section when the
  architecture was split into sub-documents (ADR-010). Always write patterns to
  the sub-document.

- **Library exclusivity must be explicit.** If the new library supersedes or
  prohibits alternatives (e.g. "MUI is the sole UI library"), say so in the ADR
  and in the usage rules section. Omitting this leads to ambiguity when reviewers
  find a component that uses a different library.

- **The `docs/arch/` files are Architect-owned.** Only the Architect Agent should
  modify files under `docs/arch/` or `docs/architecture.md`. If you are a
  Developer Agent executing a documentation task that was delegated by the
  Architect, note this explicitly in the PR description.

---

## Acceptance Checklist

- [ ] New ADR appended to `docs/tech-decisions.md` with the correct sequential number.
- [ ] ADR covers: sole-library declaration, mandatory wrappers, styling mechanism,
      standard primitives, config file location.
- [ ] Tech Stack table row added to `docs/architecture.md`.
- [ ] Domain sub-document (`docs/arch/frontend.md` or equivalent) updated with:
  - [ ] Tech Stack table row
  - [ ] Directory structure entry (if new directories are introduced)
  - [ ] Directory Responsibilities entry
  - [ ] Usage rules section
  - [ ] Key Pattern entry (if a cross-cutting constraint is introduced)
- [ ] Diff contains **only** files under `docs/`. No application code changed.

---

## Reference Tasks

- #29 — Update architecture.md and tech-decisions.md to record Material UI as the frontend component library
