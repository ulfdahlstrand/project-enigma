/**
 * Root route — renders the application shell and the Outlet for child routes.
 * This file is part of the TanStack Router file-based route system.
 */
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return <Outlet />;
}
