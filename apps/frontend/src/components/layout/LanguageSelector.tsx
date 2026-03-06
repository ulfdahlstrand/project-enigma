/**
 * LanguageSelector component — renders a locale toggle button in the Header.
 *
 * Allows the user to switch between supported application languages.
 * All styling is applied exclusively via MUI sx prop — no inline style objects
 * or imported CSS files.
 */
import Button from "@mui/material/Button";
import { useTranslation } from "react-i18next";

export function LanguageSelector() {
  const { t, i18n } = useTranslation();

  const toggleLocale = () => {
    const next = i18n.language.startsWith("fr") ? "en" : "fr";
    void i18n.changeLanguage(next);
  };

  return (
    <Button
      onClick={toggleLocale}
      color="inherit"
      sx={{ textTransform: "none" }}
    >
      {t("locale.switch")} ({i18n.language === "fr" ? "EN" : "FR"})
    </Button>
  );
}
