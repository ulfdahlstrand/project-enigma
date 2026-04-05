# Frontend Stack

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
