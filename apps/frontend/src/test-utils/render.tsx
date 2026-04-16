/**
 * Custom render utility for frontend component tests.
 *
 * Wraps the component under test with all required providers:
 *   - ThemeProvider + CssBaseline (Material UI)
 *   - QueryClientProvider (TanStack Query)
 *   - I18nextProvider (react-i18next, using the real en/common.json)
 *
 * A memoryHistory-based test router is used instead of the real TanStack
 * Router so tests remain isolated from the production route tree. Components
 * that call `Route.useParams()` or similar router hooks must still mock those
 * hooks via `vi.mock("@tanstack/react-router")` in their own test files.
 *
 * Usage:
 *   import { renderWithProviders } from "../../test-utils/render";
 *
 *   const { getByRole } = renderWithProviders(<MyComponent />, {
 *     queryClient: customQueryClient,   // optional — defaults to a fresh client
 *   });
 */
import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { theme } from "../lib/theme";
import enCommon from "../locales/en/common.json";
import { AIAssistantProvider } from "../lib/ai-assistant-context";

// ---------------------------------------------------------------------------
// i18n instance used by all tests — real locale file, synchronous init
// ---------------------------------------------------------------------------

function buildTestI18n() {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["translation", "common"],
    defaultNS: "translation",
    resources: {
      en: {
        translation: {},
        common: enCommon,
      },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

// ---------------------------------------------------------------------------
// Render options extension
// ---------------------------------------------------------------------------

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /** Provide a custom QueryClient (e.g. with spied methods) if needed. */
  queryClient?: QueryClient;
}

// ---------------------------------------------------------------------------
// Default QueryClient factory for tests
// ---------------------------------------------------------------------------

export function buildTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// renderWithProviders — main export
// ---------------------------------------------------------------------------

export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient: providedQueryClient, ...renderOptions } = options;
  const queryClient = providedQueryClient ?? buildTestQueryClient();
  const i18nInstance = buildTestI18n();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <NuqsTestingAdapter>
            <AIAssistantProvider>
              <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>
            </AIAssistantProvider>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return { ...result, queryClient };
}
