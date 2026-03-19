import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/** Set by AuthContext on successful login/refresh; cleared on logout. */
const SESSION_FLAG_KEY = "cv-tool:has-session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (!localStorage.getItem(SESSION_FLAG_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
