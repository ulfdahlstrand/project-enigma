/**
 * RevertDialog — preview + confirm for restoring a prior snapshot.
 *
 * Creates a new snapshot on the branch whose content mirrors the target
 * snapshot. Non-destructive: history is preserved.
 */
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

interface RevertDialogProps {
  open: boolean;
  targetLabel: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function RevertDialog({
  open,
  targetLabel,
  isPending,
  error,
  onClose,
  onConfirm,
}: RevertDialogProps) {
  const { t } = useTranslation("common");

  function handleClose() {
    if (isPending) return;
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("resume.revertDialog.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t("resume.revertDialog.description")}
        </DialogContentText>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t("resume.revertDialog.targetLabel")}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {targetLabel}
        </Typography>
        {error && (
          <Typography variant="body2" sx={{ color: "error.main", mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          {t("resume.revertDialog.cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={isPending}
          onClick={() => void onConfirm()}
        >
          {isPending ? t("resume.revertDialog.reverting") : t("resume.revertDialog.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
