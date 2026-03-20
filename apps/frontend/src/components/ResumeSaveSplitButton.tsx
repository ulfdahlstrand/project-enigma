import { useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grow from "@mui/material/Grow";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import TextField from "@mui/material/TextField";

interface ResumeSaveSplitButtonProps {
  disabled?: boolean;
  isPending?: boolean;
  canSaveAsNewVersion?: boolean;
  onSaveCurrent: () => void;
  onSaveAsNewVersion: (name: string) => Promise<void>;
}

export function ResumeSaveSplitButton({
  disabled = false,
  isPending = false,
  canSaveAsNewVersion = true,
  onSaveCurrent,
  onSaveAsNewVersion,
}: ResumeSaveSplitButtonProps) {
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useState<HTMLDivElement | null>(null);

  async function handleSaveAsNewVersion() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setError(null);
    try {
      await onSaveAsNewVersion(trimmedName);
      setDialogOpen(false);
      setName("");
    } catch {
      setError(t("resume.variants.createDialog.error"));
    }
  }

  return (
    <>
      <ButtonGroup
        variant="contained"
        ref={(el) => {
          anchorRef[1](el);
        }}
        disabled={disabled || isPending}
      >
        <Button onClick={onSaveCurrent}>
          {isPending ? t("resume.edit.saving") : t("resume.edit.saveButton")}
        </Button>
        <Button
          size="small"
          aria-label={t("resume.edit.saveActionsLabel")}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

      <Popper
        open={menuOpen}
        anchorEl={anchorRef[0]}
        placement="bottom-end"
        transition
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper>
              <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
                <MenuList autoFocusItem>
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      onSaveCurrent();
                    }}
                  >
                    {t("resume.edit.saveCurrentOption")}
                  </MenuItem>
                  <MenuItem
                    disabled={!canSaveAsNewVersion}
                    onClick={() => {
                      setMenuOpen(false);
                      setError(null);
                      setDialogOpen(true);
                    }}
                  >
                    {t("resume.edit.saveAsNewVersionOption")}
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.variants.createDialog.title")}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={t("resume.variants.createDialog.nameLabel")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("resume.variants.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!name.trim() || isPending}
            onClick={() => void handleSaveAsNewVersion()}
          >
            {isPending
              ? t("resume.variants.createDialog.creating")
              : t("resume.variants.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
