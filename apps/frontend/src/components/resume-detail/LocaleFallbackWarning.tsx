import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";

interface LocaleFallbackWarningProps {
  missingLocales: string[];
  requestedLanguage: string;
  sourceLanguage: string;
}

export function LocaleFallbackWarning({ missingLocales, requestedLanguage, sourceLanguage }: LocaleFallbackWarningProps) {
  const { t } = useTranslation("common");

  if (missingLocales.length === 0 || requestedLanguage === sourceLanguage) return null;

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      {t("resume.locale.fallbackWarning", {
        requestedLanguage: requestedLanguage.toUpperCase(),
        sourceLanguage: sourceLanguage.toUpperCase(),
      })}
    </Alert>
  );
}
