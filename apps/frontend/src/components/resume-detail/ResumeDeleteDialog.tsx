import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("resume.detail.deleteDialog.title")}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: isError ? 2 : 0 }}>
          {t("resume.detail.deleteDialog.message", { title })}
        </Typography>
        {isError && <Alert severity="error">{t("resume.detail.deleteDialog.error")}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          {t("resume.detail.deleteDialog.cancel")}
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isPending}>
          {isPending ? t("resume.detail.deleteDialog.deleting") : t("resume.detail.deleteDialog.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
