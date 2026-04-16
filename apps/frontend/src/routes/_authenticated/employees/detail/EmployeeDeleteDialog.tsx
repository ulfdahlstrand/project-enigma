import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "../../../../components/dialogs/ConfirmDeleteDialog";

interface EmployeeDeleteDialogProps {
  open: boolean;
  employeeName: string;
  isDeleting: boolean;
  hasError: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EmployeeDeleteDialog({
  open,
  employeeName,
  isDeleting,
  hasError,
  onCancel,
  onConfirm,
}: EmployeeDeleteDialogProps) {
  const { t } = useTranslation("common");

  return (
    <ConfirmDeleteDialog
      open={open}
      title={t("employee.detail.deleteDialog.title")}
      message={t("employee.detail.deleteDialog.message", { name: employeeName })}
      confirmLabel={t("employee.detail.deleteDialog.confirm")}
      confirmingLabel={t("employee.detail.deleteDialog.deleting")}
      cancelLabel={t("employee.detail.deleteDialog.cancel")}
      isPending={isDeleting}
      hasError={hasError}
      errorMessage={t("employee.detail.deleteDialog.error")}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  );
}
