# Frontend Architecture

> Sub-document of [architecture.md](../architecture.md). Covers UI, components, styling, routing, data-fetching, and i18n.

## Tech Stack

| Concern | Technology | Notes |
|---------|-----------|-------|
| Framework | **React** | Component-based UI |
| Component library | **Material UI** (`@mui/material`) | `ThemeProvider` + `CssBaseline` at app root; `sx` prop for styling. See ADR-008. |
| Styling engine | **Emotion** (`@emotion/react`, `@emotion/styled`) | Implementation detail of MUI — do not use directly outside MUI's API. |
| Flag icons | **`country-flag-icons`** | Tree-shakeable SVG flag components. Import from `country-flag-icons/react/3x2`. See ADR-009. |
| Bundler | **Vite** | ESM-based dev server with HMR; Rollup-based production builds. Config in `apps/frontend/vite.config.ts`. |
| Routing | **TanStack Router** | File-based routing with route codegen via `@tanstack/router-plugin/vite`. Generated `routeTree.gen.ts` is gitignored. |
| Data-fetching | **TanStack Query** | Server-state management and caching. All backend calls go through TanStack Query hooks wrapping the oRPC client. |
| i18n | **react-i18next** | All user-facing strings must be translated via `useTranslation` hooks. |

---

## Directory Structure

```
apps/frontend/
├── vite.config.ts
├── index.html
├── .env.example
└── src/
    ├── main.tsx
    ├── routes/
    │   ├── __root.tsx
    │   └── index.tsx
    ├── components/
    │   └── layout/
    │       ├── BaseLayout.tsx
    │       ├── Header.tsx
    │       ├── Footer.tsx
    │       └── NavigationMenu.tsx
    ├── lib/
    │   ├── orpc-client.ts
    │   ├── i18n.ts
    │   └── theme.ts
    └── locales/
        └── en/
            └── common.json
```

### Directory Responsibilities

- **`src/routes/`** — TanStack Router file-based route definitions. `__root.tsx` renders the layout shell.
- **`src/components/`** — Shared UI components built with Material UI. Organised by domain in kebab-case subdirectories (e.g. `layout/`). Component files use PascalCase (e.g. `BaseLayout.tsx`).
- **`src/components/layout/`** — Layout shell components that wrap all pages — `BaseLayout.tsx`, `Header.tsx`, `Footer.tsx`, `NavigationMenu.tsx`. Rendered in `__root.tsx` and persist across route changes.
- **`src/lib/`** — Library/config initialisation files (`orpc-client.ts`, `i18n.ts`, `theme.ts`).
- **`src/locales/`** — i18n translation JSON files, organised by language code.

---

## Material UI — Component and Styling Rules

MUI is the **sole** component/UI library (ADR-008). All frontend UI must be built using MUI components.

### Mandatory Setup

- `ThemeProvider` and `CssBaseline` must be rendered at the application root (in `__root.tsx`), wrapping the component tree.
- Theme configuration lives in `apps/frontend/src/lib/theme.ts` via `createTheme()`.

### Styling Rules

- The `sx` prop is the primary styling mechanism.
- The following are **not permitted** where MUI's `sx` prop or theme covers the need:
  - Raw CSS files (`.css`, `.scss`, etc.) in the frontend source directory
  - Inline `style` objects on JSX elements
  - Standalone Emotion `styled()` calls outside of MUI's component API
- MUI components are the standard primitives: `Box`, `Stack`, `Container` for layout; `AppBar`, `Toolbar`, `Drawer`, `List` for navigation; `Typography` for text.

---

## Flag Icons — `country-flag-icons`

Country flag icons are provided by the **`country-flag-icons`** package (ADR-009). This is an **asset library**, not a component library — ADR-008 remains intact.

### Usage

- Import from `country-flag-icons/react/3x2` (landscape) or `country-flag-icons/react/1x1` (square). Prefer `3x2`.
- Flags use **ISO 3166-1 alpha-2** country codes (e.g. `GB`, `SE`, `DE`).
- The **locale-to-country-code mapping** (e.g. `en` → `GB`) is the consuming component's responsibility.
- Size flags via MUI's `sx` prop on a wrapping `Box` or via `width`/`height` props on the SVG.
- **No other flag/icon library** may be introduced without a new ADR.
- Dependency of `@cv-tool/frontend` only.

---

## Routing — TanStack Router

- File-based routing with automatic route codegen (ADR-007).
- Route files live in `src/routes/`. The codegen produces `routeTree.gen.ts` which is gitignored.
- Route loaders may pre-fetch data via TanStack Query's `prefetchQuery`.

---

## Data Fetching — TanStack Query

- All server-state is managed via TanStack Query (ADR-007).
- **No direct `fetch` calls.** All backend communication goes through TanStack Query hooks using the oRPC client internally.
- `QueryClient` must be configured at the application root and provided via context.
- Data-fetching logic is co-located with query key definitions for explicit cache invalidation.

---

## i18n — react-i18next

- All user-facing strings must be translated via `useTranslation` hooks.
- Translation files live in `src/locales/<lang>/common.json`.
- Configuration lives in `src/lib/i18n.ts`.
