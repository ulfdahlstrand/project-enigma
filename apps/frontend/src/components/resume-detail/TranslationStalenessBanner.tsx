import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import { useGetTranslationStatus, useCreateCommitTag } from "../../hooks/versioning";

interface TranslationStalenessBannerProps {
  /** The source resume (the one being translated FROM). */
  sourceResumeId: string;
  /** This resume — the target / translation. */
  targetResumeId: string;
  /** Current HEAD commit id of this (target) resume, used for "mark as updated". */
  targetHeadCommitId: string | null;
  /** Human-readable name of the source resume. */
  sourceName: string;
}

export function TranslationStalenessBanner({
  sourceResumeId,
  targetResumeId,
  targetHeadCommitId,
  sourceName,
}: TranslationStalenessBannerProps) {
  const { t } = useTranslation("common");
  const { data: status } = useGetTranslationStatus(sourceResumeId, targetResumeId);
  const createTag = useCreateCommitTag();

  if (!status?.isStale) return null;

  async function handleMarkCaughtUp() {
    if (!status?.sourceHeadCommitId || !targetHeadCommitId) return;
    await createTag.mutateAsync({
      sourceCommitId: status.sourceHeadCommitId,
      targetCommitId: targetHeadCommitId,
      sourceResumeId,
      targetResumeId,
    });
  }

  return (
    <Alert
      severity="warning"
      action={
        <Button
          color="inherit"
          size="small"
          disabled={createTag.isPending}
          onClick={() => void handleMarkCaughtUp()}
        >
          {t("resume.translationStalenessBanner.markCaughtUp")}
        </Button>
      }
    >
      <AlertTitle>{t("resume.translationStalenessBanner.title")}</AlertTitle>
      {t("resume.translationStalenessBanner.description", { sourceName })}
    </Alert>
  );
}
