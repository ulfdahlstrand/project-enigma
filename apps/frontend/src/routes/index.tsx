/**
 * Index route — renders at the "/" path.
 *
 * This is the placeholder home page. It demonstrates:
 * - TanStack Router file-based routing
 * - react-i18next translation (app.title key)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("home.heading")}</p>
      <p>{t("home.description")}</p>
    </main>
  );
}
