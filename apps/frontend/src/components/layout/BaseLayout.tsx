/**
 * BaseLayout component — Office 365 / Word-inspired application shell.
 *
 * Fixed Header at the top (z-index above sidebar), fixed sidebar on the left,
 * scrollable main content offset from both. Footer omitted in favour of the
 * clean content-area pattern used by modern Office web apps.
 *
 * Styling via MUI sx prop only — no inline styles or CSS files.
 */
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";
import { NavigationMenu } from "./NavigationMenu";
import { SIDEBAR_WIDTH } from "../../lib/theme";

export function BaseLayout() {
  return (
    <Box sx={{ display: "flex" }}>
      <Header />

      {/* Fixed sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          pt: "48px", // header height
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        <NavigationMenu />
      </Box>

      {/* Content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${SIDEBAR_WIDTH}px`,
          pt: "48px", // header height
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
