/**
 * ConfirmDeleteDialog — generic confirm-before-delete dialog primitive.
 * Accepts pre-translated strings so it remains UI-agnostic and testable
 * without an i18n context.
 *
 * Styling: MUI sx prop only
 */
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  /** Dialog heading, translated by the caller. */
  title: string;
  /** Body text, translated by the caller. */
  message: string;
  /** Label for the confirm button in idle state. */
  confirmLabel: string;
  /** Label for the confirm button while the mutation is pending. */
  confirmingLabel: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  isPending: boolean;
  /** When true an error Alert is rendered inside the dialog. */
  hasError?: boolean;
  /** Error body text, translated by the caller. Required when hasError can be true. */
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmingLabel,
  cancelLabel,
  isPending,
  hasError = false,
  errorMessage,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: hasError ? 2 : 0 }}>{message}</Typography>
        {hasError && errorMessage && (
          <Alert severity="error">{errorMessage}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isPending}>
          {isPending ? confirmingLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
