import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "../dialogs/ConfirmDeleteDialog";

interface SkillsDeleteCategoryDialogProps {
  open: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SkillsDeleteCategoryDialog({
  open,
  isDeleting,
  onCancel,
  onConfirm,
}: SkillsDeleteCategoryDialogProps) {
  const { t } = useTranslation("common");

  return (
    <ConfirmDeleteDialog
      open={open}
      title={t("resume.edit.skillDeleteCategoryDialog.title")}
      message={t("resume.edit.skillDeleteCategoryDialog.description")}
      confirmLabel={t("resume.edit.skillDeleteCategoryDialog.confirm")}
      confirmingLabel={t("resume.edit.skillDeleteCategoryDialog.deleting")}
      cancelLabel={t("resume.edit.skillCancelButton")}
      isPending={isDeleting}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
