/**
 * EmployeeDeleteDialog — confirms destructive employee deletion. Shows an
 * inline error alert when the mutation fails so the user can retry without
 * losing the dialog.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

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
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{t("employee.detail.deleteDialog.title")}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: hasError ? 2 : 0 }}>
          {t("employee.detail.deleteDialog.message", { name: employeeName })}
        </Typography>
        {hasError && <Alert severity="error">{t("employee.detail.deleteDialog.error")}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          {t("employee.detail.deleteDialog.cancel")}
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting
            ? t("employee.detail.deleteDialog.deleting")
            : t("employee.detail.deleteDialog.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
