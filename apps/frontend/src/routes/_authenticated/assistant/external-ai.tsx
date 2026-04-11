import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assistant/external-ai")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/assistant/external-ai" });
  },
});
