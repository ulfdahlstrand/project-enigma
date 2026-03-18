/**
 * BaseLayout — Google Docs/Drive-inspired application shell.
 *
 * Structure:
 *   ┌──────────────────────────────────────┐
 *   │  Header (white, sticky, full-width)  │
 *   ├──────────┬───────────────────────────┤
 *   │  Sidebar │  Content (gray bg)        │
 *   │  (white) │                           │
 *   └──────────┴───────────────────────────┘
 */
import Box from "@mui/material/Box";
import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";
import { NavigationMenu } from "./NavigationMenu";
import { SIDEBAR_WIDTH } from "../../lib/theme";

export function BaseLayout() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />

      <Box sx={{ display: "flex", flexGrow: 1 }}>
        {/* White sidebar */}
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            position: "fixed",
            top: 56,
            bottom: 0,
            left: 0,
            overflowY: "auto",
            zIndex: 1100,
          }}
        >
          <NavigationMenu />
        </Box>

        {/* Gray content area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: `${SIDEBAR_WIDTH}px`,
            bgcolor: "background.default",
            minHeight: "calc(100vh - 56px)",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
