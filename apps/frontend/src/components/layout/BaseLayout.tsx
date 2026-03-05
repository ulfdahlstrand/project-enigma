/**
 * BaseLayout component — the application shell shared by all routes.
 *
 * Renders Header at the top, a side NavigationMenu alongside the matched child
 * route via <Outlet />, and Footer at the bottom. Wired into TanStack Router's
 * __root.tsx so it persists across all client-side navigations without
 * unmounting.
 *
 * Layout uses MUI Box with flexbox to ensure the footer is pushed to the bottom
 * of the viewport when content is short, with the NavigationMenu positioned as
 * a persistent side column next to the main content area. Styling is applied
 * exclusively via MUI sx prop — no inline style objects or imported CSS files.
 */
import Box from "@mui/material/Box";
import { Outlet } from "@tanstack/react-router";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { NavigationMenu } from "./NavigationMenu";

export function BaseLayout() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <Box sx={{ display: "flex", flexGrow: 1 }}>
        <Box component="nav" sx={{ width: 200, flexShrink: 0 }}>
          <NavigationMenu />
        </Box>
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}
