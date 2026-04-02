import { useTranslation } from "react-i18next";
import { DiffReviewDialog } from "../ai-assistant/DiffReviewDialog";

interface ResumeRevisionReviewDialogProps {
  reviewDialog: any;
}

export function ResumeRevisionReviewDialog({ reviewDialog }: ResumeRevisionReviewDialogProps) {
  const { t } = useTranslation("common");

  if (!reviewDialog) {
    return null;
  }

  return (
    <DiffReviewDialog
      open={reviewDialog.isOpen}
      value={reviewDialog.value}
      renderReview={reviewDialog.renderReview}
      formatResult={reviewDialog.formatResult}
      onApply={reviewDialog.onApply}
      onKeepEditing={reviewDialog.onKeepEditing}
      onDiscard={reviewDialog.onDiscard}
      title={t("revision.inline.reviewDialogTitle")}
      applyLabel={t("revision.inline.approveSuggestion")}
      keepEditingLabel={t("revision.inline.reviewLater")}
      discardLabel={t("revision.inline.dismissSuggestion")}
    />
  );
}
