/**
 * Root route — renders the application shell and the Outlet for child routes.
 * This file is part of the TanStack Router file-based route system.
 *
 * BaseLayout wraps all routes and persists across client-side navigations,
 * providing the Header and Footer chrome for the entire application.
 */
import { createRootRoute } from "@tanstack/react-router";
import { BaseLayout } from "../components/layout/BaseLayout";

export const Route = createRootRoute({
  component: BaseLayout,
});
