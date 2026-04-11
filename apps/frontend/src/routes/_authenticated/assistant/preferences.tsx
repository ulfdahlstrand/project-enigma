import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assistant/preferences")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/assistant/preferences" });
  },
});
