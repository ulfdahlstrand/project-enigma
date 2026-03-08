# Recipe: Adding a Frontend Read-Only Route with oRPC + TanStack Query + MUI

## When to Use

When adding a new read-only page to the frontend that fetches a list (or detail)
from the backend via the oRPC client, renders it with Material UI components, and
translates all visible text via react-i18next. This is the canonical pattern for
any new "list view" or "detail view" route in `@cv-tool/frontend`.

---

## Context / Background

This pattern was established in Task #62 (the `/employee` route) and is the
required integration pattern for all subsequent feature pages. It connects:

- **TanStack Router** file-based routing (ADR-007) — one `.tsx` file per route
  under `src/routes/`
- **TanStack Query** + **oRPC client** for data fetching — no direct `fetch()`,
  `axios`, or `XMLHttpRequest` calls (enforced by architecture and verified by tests)
- **Material UI** components (ADR-008) — `sx` prop for all styling; no `.css`/
  `.scss` imports, no `style={{ }}` props
- **react-i18next** (`useTranslation`) for all visible text — no bare string
  literals as direct JSX children; all translation keys in `src/locales/en/common.json`

The route file is the unit of delivery: it contains the `createFileRoute` call,
the `useQuery` hook, the MUI rendering, and all i18n calls. Tests are co-located
(same directory, `.test.tsx` suffix) per ADR-011.

### Key gotchas discovered during Task #62

1. **The `common` i18n namespace must be registered in `i18n.ts`.** Before Task
   #62 the `common` namespace existed in `src/locales/en/common.json` and was
   used by `NavigationMenu.tsx` — but it was never registered in `i18n.ts` or
   in the test setup file. Any new route using `useTranslation("common")` will
   silently fall back to raw keys unless you verify both files are updated.

2. **oRPC procedures without an `.input()` schema accept `{}` as argument.** The
   `listEmployees` contract is defined as `oc.output(schema)` with no `.input()`.
   Call it as `orpc.listEmployees({})` — passing an empty object is the safe
   pattern regardless of whether input is defined.

3. **TanStack Router codegen (`routeTree.gen.ts`) is gitignored** and regenerated
   automatically on `npm run dev` or `npm run build`. Never commit this file; the
   route will register correctly as long as the file exists at the right path.

4. **French locale falls back to English by default.** The `fr` resources object
   in `i18n.ts` currently maps `common` to the English `enCommon` JSON. New keys
   added to `en/common.json` do not need a corresponding French translation unless
   French copy is explicitly in scope.

---

## Steps

### 1. Verify dependency tasks are merged

Before writing any code, confirm that:
- The contract procedure exists in `packages/contracts/src/index.ts` (e.g.
  `listEmployees` is exported and registered in `contract = oc.router({ ... })`).
- The Zod schema file (e.g. `packages/contracts/src/employees.ts`) exists.
- Without the contract types, `tsc --noEmit` will fail (AC12) and the oRPC client
  call will not type-check.

### 2. Add translation keys to `src/locales/en/common.json`

Add a new namespace object for the page. Use a flat structure grouped by page:

```json
{
  "employee": {
    "pageTitle": "Employees",
    "pageDescription": "All employees registered in the system.",
    "loading": "Loading employees…",
    "error": "Failed to load employees. Please try again later.",
    "empty": "No employees found.",
    "tableHeaderName": "Name",
    "tableHeaderEmail": "Email"
  }
}
```

Keys to always include for a list view: `pageTitle`, `pageDescription`, `loading`,
`error`, `empty`, and one `tableHeader*` key per displayed column.

### 3. Verify the `common` namespace is registered in `src/i18n/i18n.ts`

Open `src/i18n/i18n.ts`. Confirm:

```typescript
import enCommon from "../locales/en/common.json";

export const resources = {
  en: { translation: en, common: enCommon },
  fr: { translation: fr, common: enCommon },   // fr falls back to English
} as const;

// Inside .init({ ... }):
ns: ["translation", "common"],
```

If the `common` namespace is missing from `resources` or `ns`, add it. This is
not optional — `useTranslation("common")` silently returns the raw key string if
the namespace is not registered.

### 4. Verify `src/test/setup.ts` includes the `common` namespace

The global test setup must also load `common` so component tests resolve keys:

```typescript
import enCommon from "../locales/en/common.json";

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en, common: enCommon },
  },
  ns: ["translation", "common"],
  interpolation: { escapeValue: false },
});
```

### 5. Create the route file at `src/routes/<name>.tsx`

Follow this exact structure — the `/employee` route is the reference implementation:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
// MUI sub-module imports (preferred for tree-shaking):
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { orpc } from "../orpc-client";

export const Route = createFileRoute("/your-path")({
  component: YourPage,
});

function YourPage() {
  const { t } = useTranslation("common");

  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["yourProcedureName"],
    queryFn: () => orpc.yourProcedure({}),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("yourPage.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("yourPage.error")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("yourPage.pageTitle")}
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        {t("yourPage.pageDescription")}
      </Typography>

      {items && items.length === 0 ? (
        <Typography variant="body1">{t("yourPage.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("yourPage.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("yourPage.tableHeaderName")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
```

**Rules that are verified by static grep / tsc in CI:**
- `createFileRoute("/your-path")` — exact path must match the filename
- All MUI imports from `@mui/material` sub-modules (no barrel `@mui/material` import for individual components)
- No `.css` or `.scss` imports anywhere in the file
- No `style={{ ... }}` props
- No bare string literals between JSX tags — always `{t("key")}`
- `aria-label` attribute props are excluded from the i18n rule

### 6. Add a navigation link in `NavigationMenu.tsx`

In `src/components/layout/NavigationMenu.tsx`, add a new `<ListItem>` entry:

```tsx
<ListItem disablePadding>
  <ListItemButton component={Link} to="/your-path">
    <ListItemText primary={t("nav.yourPage")} />
  </ListItemButton>
</ListItem>
```

Add the corresponding key to `src/locales/en/common.json` under `"nav"`:

```json
"nav": {
  "home": "Home",
  "test": "Test",
  "yourPage": "Your Page Label"
}
```

### 7. Write co-located tests in `src/routes/<name>.test.tsx`

Tests must be co-located with the route file. Mock the oRPC client module:

```typescript
vi.mock("../orpc-client", () => ({
  orpc: {
    yourProcedure: vi.fn(),
  },
}));

import { orpc } from "../orpc-client";
const mockProcedure = orpc.yourProcedure as ReturnType<typeof vi.fn>;
```

Build an i18n instance using the real `en/common.json` for AC11 (key resolution tests):

```typescript
import enCommon from "../locales/en/common.json";

function buildI18n() {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["translation", "common"],
    defaultNS: "translation",
    resources: { en: { translation: {}, common: enCommon } },
    interpolation: { escapeValue: false },
  });
  return instance;
}
```

Render the component directly (extract from Route):

```typescript
const YourPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={buildI18n()}>
        <YourPage />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
```

> **Note:** No `RouterProvider` is needed in the render wrapper if the component
> does not call any TanStack Router hooks (e.g. `useParams`, `useNavigate`).
> The `/employee` route does not use router hooks, so the simpler wrapper was
> sufficient. If your route uses router context, add a `RouterProvider` with a
> test router or use the full custom render from `src/test-utils/render.tsx`.

Cover these test cases at minimum:
- Empty response → translated `empty` message visible
- Single item response → item's identifying fields visible
- Multi-item response → each item's fields visible
- Static source check: `createFileRoute("/your-path")` present (AC2)
- Static source check: no `fetch(`, `axios`, `XMLHttpRequest` in non-comment lines (AC3)
- Static source check: `@mui/material` import present (AC7)
- Static source check: no `.css`/`.scss` import, no `style={{` in non-comment lines (AC8)
- Static source check: navigation file contains `/your-path` (AC9)
- No raw JSX text children (AC10) — scan non-comment lines for `>Letters<` pattern
- No raw `namespace.key` pattern in rendered output when using real locale file (AC11)

For AC10 and AC11 static/AST checks, use the `?raw` import:

```typescript
import sourceRaw from "./your-route.tsx?raw";
import navSourceRaw from "../components/layout/NavigationMenu.tsx?raw";
```

### 8. Verify TypeScript compiles cleanly

```bash
cd apps/frontend && npx tsc --noEmit
```

Zero errors required before opening a PR.

---

## Gotchas

- **`common` namespace silent failure.** If `useTranslation("common")` returns
  raw keys (e.g. `"employee.pageTitle"` appears in the DOM), the namespace is not
  registered in `i18n.ts` or `test/setup.ts`. Always check both files when adding
  a new route that uses the `common` namespace.

- **`orpc.procedure({})` vs `orpc.procedure()`.** Procedures defined with
  `.input(z.object({}))` in the contract expect `{}` as the argument. Procedures
  defined with only `.output(...)` and no `.input()` also accept `{}` safely.
  Always pass `{}` to be consistent with the existing `test.tsx` pattern.

- **`routeTree.gen.ts` must not be committed.** It is gitignored. If you see it
  appearing as a staged file, add it to `.gitignore`. TanStack Router regenerates
  it automatically when `npm run dev` or `npm run build` is run.

- **MUI sub-module imports are preferred.** Import `Table` from
  `@mui/material/Table`, not `import { Table } from "@mui/material"`. Both work
  at runtime, but sub-module imports are more tree-shake-friendly and align with
  the existing code style in the repo.

- **No `RouterProvider` in tests (unless using router hooks).** The route
  component renders fine with just `QueryClientProvider` + `I18nextProvider` if it
  does not call `useParams`, `useNavigate`, or other router hooks. Adding an
  unnecessary `RouterProvider` complicates test setup with no benefit.

- **AC10 regex check excludes comment lines.** The static grep for bare JSX text
  children must strip `//` comment lines before running. Otherwise the file's
  JSDoc comment (which may contain example strings) will produce false positives.

- **AC11 `knownNonKeys` set.** The regex `\b[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*\b`
  matches email addresses in test data (e.g. `alice@example.com` → `example.com`).
  Maintain a `Set<string>` of known non-key matches to filter from the results.

- **French locale.** The `fr` resources object falls back to the English `enCommon`
  JSON. New keys added to `en/common.json` will display in English for French users
  until proper French translations are provided. This is acceptable unless the task
  explicitly requires French copy.

---

## Acceptance Checklist

- [ ] `packages/contracts/src/index.ts` exports the procedure used by this route
      (dependency task merged before starting).
- [ ] `src/locales/en/common.json` has a new key group for the page (`pageTitle`,
      `pageDescription`, `loading`, `error`, `empty`, `tableHeader*`).
- [ ] The `common` namespace is registered in `src/i18n/i18n.ts` (`ns` array +
      `resources` object for both `en` and `fr`).
- [ ] The `common` namespace is registered in `src/test/setup.ts`.
- [ ] `src/routes/<name>.tsx` exists and exports `const Route = createFileRoute("/path")({ ... })`.
- [ ] All visible text in the route file uses `{t("key")}` — no bare string
      literals between JSX tags.
- [ ] All MUI imports are from `@mui/material` (sub-module or root barrel) — no
      other component library used.
- [ ] No `.css`/`.scss` imports. No `style={{ }}` props.
- [ ] A navigation link for the new route is present in `NavigationMenu.tsx` using
      `t("nav.yourKey")` for the label.
- [ ] `nav.yourKey` is added to `src/locales/en/common.json`.
- [ ] Co-located test file `src/routes/<name>.test.tsx` exists with component
      tests for empty, single-item, and multi-item responses, plus static checks
      for AC2, AC3, AC7, AC8, AC9, AC10, AC11.
- [ ] `npx tsc --noEmit` in `apps/frontend/` exits with zero errors.

---

## Reference Tasks

- #62 — Build `/employee` frontend route that lists employees from the backend
