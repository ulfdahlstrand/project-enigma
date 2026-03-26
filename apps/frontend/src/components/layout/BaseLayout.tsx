/**
 * BaseLayout — sidebar-first application shell.
 *
 * Structure:
 *   ┌──────────┬───────────────────────────┐
 *   │  Brand   │                           │
 *   │  ──────  │  Content (gray bg)        │
 *   │  Nav     │                           │
 *   └──────────┴───────────────────────────┘
 *
 * The global full-width header has been removed. Brand/logo lives at the
 * top of the sidebar. Each page owns its own header inside the content area.
 */
import Box from "@mui/material/Box";
import { Outlet } from "@tanstack/react-router";
import { NavigationMenu } from "./NavigationMenu";
import { SIDEBAR_WIDTH } from "../../lib/theme";
import { useAuth } from "../../auth/auth-context";

export function BaseLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* White sidebar — only shown when authenticated */}
      {isAuthenticated && (
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            overflowY: "auto",
            zIndex: 1100,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <NavigationMenu />
        </Box>
      )}

      {/* Gray content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: isAuthenticated ? `${SIDEBAR_WIDTH}px` : 0,
          bgcolor: "background.default",
          minHeight: "100vh",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
