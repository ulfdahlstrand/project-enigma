import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensureAuthSession } from "../auth/session-store";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async () => {
    const session = await ensureAuthSession();

    if (session.status !== "authenticated") {
      throw redirect({ to: "/login" });
    }

    if (!session.user || session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
