/**
 * Index route — renders at the "/" path.
 *
 * This is the placeholder home page. It demonstrates:
 * - TanStack Router file-based routing
 * - react-i18next translation (home.welcome key)
 * - MUI Typography for accessible heading
 */
import { Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <main>
      <Typography variant="h4" component="h1">{t("home.welcome")}</Typography>
      <p>{t("home.heading")}</p>
      <p>{t("home.description")}</p>
    </main>
  );
}
