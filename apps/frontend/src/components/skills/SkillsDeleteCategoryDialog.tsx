import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

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
    <Dialog
      open={open}
      onClose={() => {
        if (!isDeleting) {
          onCancel();
        }
      }}
    >
      <DialogTitle>{t("resume.edit.skillDeleteCategoryDialog.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {t("resume.edit.skillDeleteCategoryDialog.description")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          {t("resume.edit.skillCancelButton")}
        </Button>
        <Button color="error" variant="contained" disabled={isDeleting} onClick={onConfirm}>
          {isDeleting
            ? t("resume.edit.skillDeleteCategoryDialog.deleting")
            : t("resume.edit.skillDeleteCategoryDialog.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
