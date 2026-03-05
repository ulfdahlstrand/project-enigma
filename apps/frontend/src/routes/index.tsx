/**
 * Index route — renders at the "/" path.
 *
 * This is the placeholder home page. It demonstrates:
 * - TanStack Router file-based routing
 * - react-i18next translation (app.title key)
 * - Locale switching to a second locale (fr)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t, i18n } = useTranslation();

  const toggleLocale = () => {
    const next = i18n.language.startsWith("fr") ? "en" : "fr";
    void i18n.changeLanguage(next);
  };

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("home.heading")}</p>
      <p>{t("home.description")}</p>
      <button onClick={toggleLocale} type="button">
        {t("locale.switch")} ({i18n.language === "fr" ? "EN" : "FR"})
      </button>
    </main>
  );
}
