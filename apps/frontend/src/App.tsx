/**
 * Root application component.
 *
 * Wires together all providers in the correct order:
 *   1. GoogleOAuthProvider -- Google OAuth; required by @react-oauth/google
 *   2. AuthProvider        -- CV Tool auth context; token storage
 *   3. ColorModeProvider   -- dark/light mode with system-preference fallback
 *   4. ThemeProvider       -- Material UI; supplies the MUI theme to all child components
 *   5. CssBaseline         -- Material UI; normalises browser default styles globally
 *   6. QueryClientProvider -- TanStack Query; makes useQuery/useMutation available everywhere
 *   7. RouterProvider      -- TanStack Router; renders the matched route
 *
 * i18n is initialised as a side-effect in `src/i18n/i18n.ts` (imported in main.tsx
 * before this component mounts), so no additional provider is needed here.
 */
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import { createAppTheme } from "./lib/theme";
import { ColorModeProvider, useColorMode } from "./lib/color-mode-context";
import { queryClient } from "./query-client";
import { router } from "./router";
import { AuthProvider } from "./auth/auth-context";
import { AIAssistantProvider } from "./lib/ai-assistant-context";
import { AIAssistantDrawer } from "./components/ai-assistant/AIAssistantDrawer";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function ThemedApp() {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AIAssistantProvider>
          <RouterProvider router={router} />
          <AIAssistantDrawer />
        </AIAssistantProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function App() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ColorModeProvider>
          <ThemedApp />
        </ColorModeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
