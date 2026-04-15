/**
 * TranslationStaleBanner — warns the user that the translation branch is stale
 * (its source variant has moved ahead) and lets them mark it as caught up.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useMarkTranslationCaughtUp } from "../hooks/versioning";

interface TranslationStaleBannerProps {
  resumeId: string;
  branchId: string;
}

export function TranslationStaleBanner({ resumeId, branchId }: TranslationStaleBannerProps) {
  const { t } = useTranslation("common");
  const markCaughtUp = useMarkTranslationCaughtUp();
  const [error, setError] = useState<string | null>(null);

  async function handleMarkCaughtUp() {
    setError(null);
    try {
      await markCaughtUp.mutateAsync({ branchId, resumeId });
    } catch {
      setError(t("resume.translationStaleBanner.error"));
    }
  }

  return (
    <>
      <Alert
        severity="warning"
        action={
          <Button
            color="inherit"
            size="small"
            disabled={markCaughtUp.isPending}
            onClick={() => void handleMarkCaughtUp()}
          >
            {markCaughtUp.isPending
              ? t("resume.translationStaleBanner.markingCaughtUp")
              : t("resume.translationStaleBanner.markCaughtUpButton")}
          </Button>
        }
      >
        <AlertTitle>{t("resume.translationStaleBanner.title")}</AlertTitle>
        {t("resume.translationStaleBanner.description")}
      </Alert>
      {error && (
        <Typography variant="body2" sx={{ color: "error.main", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </>
  );
}
