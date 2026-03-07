# Recipe: Installing a UI Library and Wiring Its Providers

## When to Use

When a task requires installing Material UI (or a similarly structured component
library) into `@cv-tool/frontend` and wrapping the application tree with its
foundational provider components (`ThemeProvider`, `CssBaseline`, etc.).

This recipe is a **companion** to [`architecture-doc-update.md`](./architecture-doc-update.md).
The architecture documentation task (#29) **must** be merged before this recipe
is applied — the library must be formally recorded in `architecture.md` before
any implementation code lands.

---

## Context / Background

Material UI requires two things before any MUI component can be used:

1. **`ThemeProvider`** — injects the MUI theme object into the React context so
   every child component can access design tokens (palette, typography, spacing).
2. **`CssBaseline`** — applies a global CSS normalisation (similar to `normalize.css`)
   that ensures consistent baseline styles across browsers. It must live _inside_
   `ThemeProvider` so it picks up the active theme.

The `@cv-tool/frontend` app already composes multiple React context providers in
`App.tsx` (TanStack Query's `QueryClientProvider`, TanStack Router's
`RouterProvider`). `ThemeProvider` must wrap all of these, making it the outermost
provider. `CssBaseline` sits immediately inside `ThemeProvider` as a sibling
before the rest of the tree — it is a render-time side-effect component with no
children of its own.

**Key pattern from ADR-008:**
> `ThemeProvider` → `CssBaseline` → `QueryClientProvider` → `RouterProvider`

Theme configuration lives in `src/lib/theme.ts`, following the established
`src/lib/` pattern used by `orpc-client.ts` and `i18n.ts`.

Relevant constraints (all from ADR-008 / architecture.md):
- No raw `.css` files may be introduced under `apps/frontend/src/`.
- No `any` type assertions or `@ts-ignore`/`@ts-expect-error` comments (ADR-003).
- Dependencies are scoped to `apps/frontend/package.json` only — no changes to
  `packages/` or `apps/backend/`.
- The bare `createTheme()` call (no arguments) is the correct starting point;
  custom palette/typography belongs in a dedicated theming task.

---

## Steps

### 1. Confirm the dependency task is merged

Verify the architecture documentation task is closed and merged. Check
`docs/architecture.md` for the new library row in the Tech Stack table, and
`docs/tech-decisions.md` for the corresponding ADR. If either is missing, post a
blocker comment — do not proceed.

### 2. Add the runtime dependencies to `apps/frontend/package.json`

Open `apps/frontend/package.json`. In the `"dependencies"` object (not
`"devDependencies"`), add:

```json
"@emotion/react": "^11.14.0",
"@emotion/styled": "^11.14.0",
"@mui/material": "^6.4.0"
```

These three packages are all required by MUI: `@emotion/react` and
`@emotion/styled` are peer dependencies of `@mui/material` and must be explicit
runtime deps.

### 3. Run `npm install` from the repository root

```bash
npm install
```

This regenerates `package-lock.json`. Include the updated lock file in your
commit alongside `package.json`.

### 4. Create `apps/frontend/src/lib/theme.ts`

```typescript
/**
 * Material UI theme configuration.
 *
 * A bare default theme is exported here and provided to the component tree via
 * ThemeProvider in App.tsx. No custom palette, typography, or branding overrides
 * are applied — those are deferred to a dedicated theming task.
 */
import { createTheme } from "@mui/material/styles";

export const theme = createTheme();
```

Notes:
- Named export (`export const theme`) is preferred over default export for
  consistency with other `src/lib/` files.
- `createTheme()` is imported from `@mui/material/styles` (not `@mui/material`)
  to keep the import path sub-module-specific and tree-shakeable.
- **No arguments** — no palette, typography, spacing, or component overrides.
  Defer all branding to a dedicated theming task.

### 5. Update `apps/frontend/src/App.tsx`

**a) Add the imports** at the top of the file:

```typescript
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./lib/theme";
```

Note the sub-module import paths:
- `ThemeProvider` comes from `@mui/material/styles` (not `@mui/material`).
- `CssBaseline` comes from `@mui/material/CssBaseline` (or `@mui/material`).
  Either is acceptable; the sub-module path is preferred for tree-shaking.

**b) Update the provider-order comment** at the top of the file to document all
four providers. Follow the existing block-comment style already present in
`App.tsx`:

```typescript
/**
 * Root application component.
 *
 * Wires together all providers in the correct order:
 *   1. ThemeProvider      -- Material UI; supplies the MUI theme to all child components
 *   2. CssBaseline        -- Material UI; normalises browser default styles globally
 *   3. QueryClientProvider -- TanStack Query; makes useQuery/useMutation available everywhere
 *   4. RouterProvider     -- TanStack Router; renders the matched route
 *
 * i18n is initialised as a side-effect in `src/i18n/i18n.ts` (imported in main.tsx
 * before this component mounts), so no additional provider is needed here.
 */
```

**c) Wrap the JSX tree**:

```tsx
export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

`CssBaseline` is a self-closing element with no children — it is placed as a
sibling immediately inside `ThemeProvider`, before `QueryClientProvider`.

### 6. Verify acceptance criteria (pre-commit checklist)

Run through the checklist in the section below before opening a PR.

---

## Gotchas

- **`ThemeProvider` must come from `@mui/material/styles`, not `@mui/material`.**
  Importing it from the root `@mui/material` barrel does work at runtime, but the
  sub-path import is the correct pattern per MUI documentation and aligns with the
  architecture's tree-shaking preference.

- **`CssBaseline` has no children — never try to wrap content in it.** It is a
  global-styles side-effect component. Treat it like a void element: `<CssBaseline />`.

- **`CssBaseline` must be _inside_ `ThemeProvider`.** If it is placed outside
  or before `ThemeProvider`, it will not receive the active theme and the
  normalisation will not respect theme-level font settings.

- **Do not place `ThemeProvider` inside `__root.tsx` if `App.tsx` already exists
  as the provider composition layer.** The Architect's notes for task #33
  explicitly designate `App.tsx` as the correct location. `__root.tsx` handles
  TanStack Router's layout/outlet concern; provider wiring belongs in `App.tsx`.

- **`createTheme()` with no arguments is intentional.** Do not add even a single
  override. The bare default theme is the starting state; all customisation is a
  separate, reviewable task. Adding overrides here will fail AC #10 in the test suite.

- **Dependencies are runtime, not dev.** All three packages (`@mui/material`,
  `@emotion/react`, `@emotion/styled`) belong in `"dependencies"` in
  `apps/frontend/package.json`, not `"devDependencies"`. They are required at
  runtime in production.

- **The lock file must be committed.** After running `npm install`, the root
  `package-lock.json` will be updated. It must be included in the same commit as
  `package.json`. Forgetting to commit it will leave the repo in an inconsistent
  state.

- **No `.css` files.** Resist the reflex to add a global CSS file for resets.
  `CssBaseline` replaces that need entirely. Introducing a `.css` file will fail
  AC #8 and violate ADR-008's "no raw CSS" rule.

- **MUI version selection.** At the time of implementation, `@^6.4.0` was selected
  as MUI v6 is the current stable release compatible with React 19. If the project
  has since upgraded, verify compatibility before bumping the version range.

---

## Acceptance Checklist

- [ ] `apps/frontend/package.json` lists `@mui/material`, `@emotion/react`, and
      `@emotion/styled` under `"dependencies"` (not `"devDependencies"`).
- [ ] Root `package-lock.json` was regenerated with `npm install` and is included
      in the commit.
- [ ] `apps/frontend/src/lib/theme.ts` exists and exports a `createTheme()` result
      with no arguments (no palette, typography, spacing, or component overrides).
- [ ] `ThemeProvider` (from `@mui/material/styles`) wraps the full provider tree
      in `App.tsx`, receiving `theme` from `lib/theme.ts` as its `theme` prop.
- [ ] `CssBaseline` (from `@mui/material` or `@mui/material/CssBaseline`) is
      rendered as a self-closing direct child immediately inside `ThemeProvider`.
- [ ] The block comment at the top of `App.tsx` lists all four providers in order:
      `ThemeProvider` → `CssBaseline` → `QueryClientProvider` → `RouterProvider`.
- [ ] No `.css` files exist under `apps/frontend/src/` (`find apps/frontend/src -name "*.css"` returns empty).
- [ ] No `any` type assertions, `@ts-ignore`, or `@ts-expect-error` in any changed file.
- [ ] `npm run typecheck` exits zero (or pre-existing failures are confirmed to
      exist identically on `main` — stash your changes and re-run to verify).
- [ ] `npm run build` exits zero (same caveat as typecheck).

---

## Reference Tasks

- #29 — Update architecture.md and tech-decisions.md to record Material UI as the frontend component library _(prerequisite — must be merged first)_
- #33 — Install and configure Material UI with ThemeProvider and CssBaseline
