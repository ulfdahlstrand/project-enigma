/**
 * TranslationStaleBanner — warns the user that the translation branch is stale
 * (its source variant has moved ahead) and offers the guided sync flow that
 * rebases the translation onto the latest source content.
 *
 * The destructive "ful rebase" goes through the SyncDialog wizard so the user
 * sees what is about to change before it happens.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import { useRebaseTranslationOntoSource } from "../hooks/versioning";
import { SyncDialog } from "./SyncDialog";

interface TranslationStaleBannerProps {
  resumeId: string;
  branchId: string;
  sourceName?: string;
}

export function TranslationStaleBanner({
  resumeId,
  branchId,
  sourceName = "",
}: TranslationStaleBannerProps) {
  const { t } = useTranslation("common");
  const rebase = useRebaseTranslationOntoSource();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await rebase.mutateAsync({ branchId, resumeId });
      setOpen(false);
    } catch {
      setError(t("resume.syncDialog.error"));
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
            disabled={rebase.isPending}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            {t("resume.translationStaleBanner.markCaughtUpButton")}
          </Button>
        }
      >
        <AlertTitle>{t("resume.translationStaleBanner.title")}</AlertTitle>
        {t("resume.translationStaleBanner.description")}
      </Alert>

      <SyncDialog
        open={open}
        flavour="translation"
        sourceName={sourceName}
        isPending={rebase.isPending}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
