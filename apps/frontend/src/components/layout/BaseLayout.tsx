/**
 * BaseLayout component — the application shell shared by all routes.
 *
 * Renders Header at the top, the matched child route via <Outlet />, and
 * Footer at the bottom. Wired into TanStack Router's __root.tsx so it
 * persists across all client-side navigations without unmounting.
 *
 * Layout uses MUI Box with flexbox column to ensure the footer is pushed
 * to the bottom of the viewport when content is short. Styling is applied
 * exclusively via MUI sx prop — no inline style objects or imported CSS files.
 */
import Box from "@mui/material/Box";
import { Outlet } from "@tanstack/react-router";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function BaseLayout() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
}
