import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "../dialogs/ConfirmDeleteDialog";

interface ResumeDeleteDialogProps {
  open: boolean;
  title: string;
  isPending: boolean;
  isError: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResumeDeleteDialog({
  open,
  title,
  isPending,
  isError,
  onClose,
  onConfirm,
}: ResumeDeleteDialogProps) {
  const { t } = useTranslation("common");

  return (
    <ConfirmDeleteDialog
      open={open}
      title={t("resume.detail.deleteDialog.title")}
      message={t("resume.detail.deleteDialog.message", { title })}
      confirmLabel={t("resume.detail.deleteDialog.confirm")}
      confirmingLabel={t("resume.detail.deleteDialog.deleting")}
      cancelLabel={t("resume.detail.deleteDialog.cancel")}
      isPending={isPending}
      hasError={isError}
      errorMessage={t("resume.detail.deleteDialog.error")}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
