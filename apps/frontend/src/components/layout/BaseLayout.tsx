/**
 * BaseLayout component — Slack-inspired application shell.
 *
 * Layout: full-height sidebar (aubergine) on the left containing the app
 * name and navigation, with a scrollable white content area on the right.
 * No separate Header or Footer — they are integrated into the sidebar and
 * content area respectively, keeping the chrome minimal.
 */
import Box from "@mui/material/Box";
import { Outlet } from "@tanstack/react-router";
import { NavigationMenu } from "./NavigationMenu";
import { SIDEBAR_BG, SIDEBAR_WIDTH } from "../../lib/theme";

export function BaseLayout() {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: SIDEBAR_BG,
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          overflowY: "auto",
          zIndex: 1200,
        }}
      >
        <NavigationMenu />
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${SIDEBAR_WIDTH}px`,
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
