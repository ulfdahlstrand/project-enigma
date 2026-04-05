# Frontend Structure

## Directory Structure

```text
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

## Directory Responsibilities

- **`src/routes/`** — TanStack Router file-based route definitions. `__root.tsx` renders the layout shell.
- **`src/components/`** — Shared UI components built with Material UI. Organised by domain in kebab-case subdirectories. Component files use PascalCase.
- **`src/components/layout/`** — Layout shell components that wrap all pages and persist across route changes.
- **`src/lib/`** — Library/config initialisation files such as `orpc-client.ts`, `i18n.ts`, and `theme.ts`.
- **`src/locales/`** — i18n translation JSON files, organised by language code.
