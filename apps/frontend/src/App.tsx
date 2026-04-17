/**
 * Root application component.
 *
 * Wires together all providers in the correct order:
 *   1. MsalProvider        -- Microsoft Entra authentication
 *   2. AuthProvider        -- CV Tool auth context; cookie/session bootstrap
 *   3. ColorModeProvider   -- dark/light mode with system-preference fallback
 *   4. ThemeProvider       -- Material UI; supplies the MUI theme to all child components
 *   5. CssBaseline         -- Material UI; normalises browser default styles globally
 *   6. QueryClientProvider -- TanStack Query; makes useQuery/useMutation available everywhere
 *   7. NuqsAdapter         -- nuqs; enables type-safe URL search-param hooks inside routes
 *   8. RouterProvider      -- TanStack Router; renders the matched route
 *
 * i18n is initialised as a side-effect in `src/i18n/i18n.ts` (imported in main.tsx
 * before this component mounts), so no additional provider is needed here.
 */
import { MsalProvider } from "@azure/msal-react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { useMemo } from "react";
import { createAppTheme } from "./lib/theme";
import { ColorModeProvider, useColorMode } from "./lib/color-mode-context";
import { queryClient } from "./query-client";
import { router } from "./router";
import { AuthProvider } from "./auth/auth-context";
import { AIAssistantProvider } from "./lib/ai-assistant-context";
import { AIAssistantDrawer } from "./components/ai-assistant/AIAssistantDrawer";
import { msalInstance } from "./auth/msal-config";

function ThemedApp() {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <QueryClientProvider client={queryClient}>
          <NuqsAdapter>
            <AIAssistantProvider>
              <RouterProvider router={router} />
              <AIAssistantDrawer />
            </AIAssistantProvider>
          </NuqsAdapter>
        </QueryClientProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <ColorModeProvider>
          <ThemedApp />
        </ColorModeProvider>
      </AuthProvider>
    </MsalProvider>
  );
}
