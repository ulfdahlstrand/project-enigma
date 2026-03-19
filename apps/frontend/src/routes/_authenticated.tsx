import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

const TOKEN_KEY = "cv-tool:id-token";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
