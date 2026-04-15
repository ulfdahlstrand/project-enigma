import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

const SUPPORTED_LOCALES = ["sv", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const Route = createFileRoute("/_authenticated/$locale")({
  beforeLoad: ({ params }) => {
    if (!SUPPORTED_LOCALES.includes(params.locale as SupportedLocale)) {
      throw redirect({
        to: "/$locale/resumes",
        params: { locale: "sv" },
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
});
