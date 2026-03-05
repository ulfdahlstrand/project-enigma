# @cv-tool/frontend

React single-page application for the CV Creation Tool.

## Tech Stack

- **React** — UI framework
- **TanStack Router** — File-based routing with route codegen
- **TanStack Query** — Server-state management and caching
- **oRPC** — Typed RPC client (typed against `@cv-tool/contracts`)
- **react-i18next** — Internationalisation
- **Vite** — Dev server and bundler

---

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 11 (comes with the Node.js version above)
- Dependencies installed from repo root: `npm install`

### Running the dev server

From this workspace directory:

```bash
npm run dev
```

Or from the monorepo root (starts all workspaces):

```bash
turbo dev
# or
npm run dev
```

The dev server listens on **port 5173** (declared as `VITE_PORT=5173` in `.env.example`).
After starting, open http://localhost:5173 in your browser.

### Environment Variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

| Variable       | Default                 | Description                                    |
|----------------|-------------------------|------------------------------------------------|
| `VITE_PORT`    | `5173`                  | Port the Vite dev server listens on            |
| `VITE_API_URL` | `http://localhost:3001` | Base URL of the backend oRPC API               |

---

## Available Scripts

| Command                   | Description                                          |
|---------------------------|------------------------------------------------------|
| `npm run dev`             | Start Vite dev server with HMR                       |
| `npm run build`           | Type-check and produce a production build in `dist/` |
| `npm run typecheck`       | Run TypeScript type-checking without emitting files  |
| `npm run lint`            | Run ESLint over `src/`                               |
| `npm run routes:generate` | Re-generate the TanStack Router route tree           |

---

## Routing

Routes are defined using **file-based routing** via TanStack Router.
Add a `.tsx` file under `src/routes/` and run `npm run routes:generate` to register it.

The Vite dev server regenerates the route tree automatically on file changes.
The generated route tree is committed at `src/route-tree.gen.ts` — do not edit it manually.

---

## Internationalisation (i18n)

Translation files live in `src/i18n/locales/`:

| File      | Language |
|-----------|----------|
| `en.json` | English  |
| `fr.json` | French   |

Use the `useTranslation` hook from `react-i18next` in components:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('app.title')}</h1>;
}
```

To switch the active locale programmatically:

```ts
import i18n from './i18n/i18n';
i18n.changeLanguage('fr');
```

---

## oRPC Client

The oRPC client is exported as a singleton from `src/orpc-client.ts`.
It is typed against the `AppRouter` type from `@cv-tool/contracts`.

```ts
import { orpc } from './orpc-client';
```

The client reads the backend base URL from `VITE_API_URL` — no URL is hardcoded.
