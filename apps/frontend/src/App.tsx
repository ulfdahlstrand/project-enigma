/**
 * Root application component.
 *
 * Wires together all providers in the correct order:
 *   1. GoogleOAuthProvider -- Google OAuth; required by @react-oauth/google
 *   2. AuthProvider        -- CV Tool auth context; token storage
 *   3. ThemeProvider       -- Material UI; supplies the MUI theme to all child components
 *   4. CssBaseline         -- Material UI; normalises browser default styles globally
 *   5. QueryClientProvider -- TanStack Query; makes useQuery/useMutation available everywhere
 *   6. RouterProvider      -- TanStack Router; renders the matched route
 *
 * i18n is initialised as a side-effect in `src/i18n/i18n.ts` (imported in main.tsx
 * before this component mounts), so no additional provider is needed here.
 */
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { theme } from "./lib/theme";
import { queryClient } from "./query-client";
import { router } from "./router";
import { AuthProvider } from "./auth/auth-context";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export function App() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
