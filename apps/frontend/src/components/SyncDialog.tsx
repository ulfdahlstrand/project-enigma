/**
 * SyncDialog — shared 2-step wizard for rebasing a revision or translation
 * branch onto its source variant's current HEAD.
 *
 * Step 1: review incoming changes.
 * Step 2: confirm & snapshot.
 *
 * Both revision-rebase and translation-rebase share the same shell so the
 * interaction model is consistent. Translation flavour explains that fields
 * will need re-translation after sync.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";

export type SyncFlavour = "revision" | "translation";

interface SyncDialogProps {
  open: boolean;
  flavour: SyncFlavour;
  sourceName: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function SyncDialog({
  open,
  flavour,
  sourceName,
  isPending,
  error,
  onClose,
  onConfirm,
}: SyncDialogProps) {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<0 | 1>(0);

  const prefix = flavour === "revision" ? "resume.syncDialog.revision" : "resume.syncDialog.translation";

  function handleClose() {
    if (isPending) return;
    setStep(0);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(`${prefix}.title`)}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>{t(`${prefix}.step1Heading`)}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t(`${prefix}.step2Heading`)}</StepLabel>
          </Step>
        </Stepper>

        {step === 0 ? (
          <DialogContentText>
            {t(`${prefix}.step1Description`, { sourceName })}
          </DialogContentText>
        ) : (
          <DialogContentText>{t(`${prefix}.step2Description`)}</DialogContentText>
        )}

        {error && (
          <Typography variant="body2" sx={{ color: "error.main", mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {step === 1 && (
          <Button onClick={() => setStep(0)} disabled={isPending}>
            {t("resume.syncDialog.back")}
          </Button>
        )}
        <Button onClick={handleClose} disabled={isPending}>
          {t("resume.syncDialog.cancel")}
        </Button>
        {step === 0 ? (
          <Button variant="contained" onClick={() => setStep(1)}>
            {t("resume.syncDialog.next")}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={isPending}
            onClick={() => void onConfirm()}
          >
            {isPending
              ? t("resume.syncDialog.syncing")
              : t(`${prefix}.confirmButton`)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
