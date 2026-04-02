/**
 * SaveVersionButton — opens a dialog asking for an optional message,
 * then calls useSaveResumeVersion(branchId, message) on confirm.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import { useSaveResumeVersion } from "../hooks/versioning";

interface SaveVersionButtonProps {
  branchId: string;
}

export function SaveVersionButton({ branchId }: SaveVersionButtonProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mutation = useSaveResumeVersion();

  async function handleSave() {
    setError(null);
    try {
      const trimmed = message.trim();
      await mutation.mutateAsync({ branchId, ...(trimmed ? { title: trimmed } : {}) });
      setSuccess(true);
      setOpen(false);
      setMessage("");
    } catch {
      setError(t("resume.saveVersion.error"));
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => { setSuccess(false); setOpen(true); }}
      >
        {t("resume.saveVersion.button")}
      </Button>

      {success && (
        <Alert
          severity="success"
          sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 2000 }}
          onClose={() => setSuccess(false)}
        >
          {t("resume.saveVersion.success")}
        </Alert>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("resume.saveVersion.dialogTitle")}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            placeholder={t("resume.saveVersion.messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            {t("resume.saveVersion.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={mutation.isPending}
            onClick={() => void handleSave()}
          >
            {mutation.isPending
              ? t("resume.saveVersion.saving")
              : t("resume.saveVersion.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
