# Frontend UI Conventions

## Material UI

MUI is the **sole** component/UI library (ADR-008). All frontend UI must be
built using MUI components.

### Mandatory Setup

- `ThemeProvider` and `CssBaseline` must be rendered at the application root.
- Theme configuration lives in `apps/frontend/src/lib/theme.ts` via `createTheme()`.

### Styling Rules

- The `sx` prop is the primary styling mechanism.
- The following are **not permitted** where MUI's `sx` prop or theme covers the need:
  - raw CSS files in the frontend source directory
  - inline `style` objects on JSX elements
  - standalone Emotion `styled()` calls outside of MUI's component API
- MUI components are the standard primitives for layout and typography.

## Flags

Country flag icons are provided by the **`country-flag-icons`** package
(ADR-009).

- Import from `country-flag-icons/react/3x2` or `country-flag-icons/react/1x1`.
- Prefer `3x2`.
- Flags use ISO 3166-1 alpha-2 country codes.
- Locale-to-country-code mapping is the consuming component's responsibility.
- No other flag/icon library may be introduced without a new ADR.

## i18n

- All user-facing strings must be translated via `useTranslation` hooks.
- Translation files live in `src/locales/<lang>/common.json`.
- Configuration lives in `src/lib/i18n.ts`.
