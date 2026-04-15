/**
 * RevisionsMenu — button with dropdown listing revision branches for a variant.
 *
 * Renders on variant branch pages. Shows a count badge, lists active revisions,
 * and provides a "Create revision" option that opens a dialog.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useResumeBranches, useCreateRevisionBranch } from "../hooks/versioning";

interface RevisionsMenuProps {
  resumeId: string;
  /** ID of the current variant branch. */
  variantBranchId: string;
}

export function RevisionsMenu({ resumeId, variantBranchId }: RevisionsMenuProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: branches } = useResumeBranches(resumeId);
  const createRevision = useCreateRevisionBranch();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const revisions = (branches ?? []).filter(
    (b) => b.branchType === "revision" && b.sourceBranchId === variantBranchId
  );

  function handleOpenMenu(event: React.MouseEvent<HTMLElement>) {
    setMenuAnchor(event.currentTarget);
  }

  function handleCloseMenu() {
    setMenuAnchor(null);
  }

  function handleOpenCreateDialog() {
    handleCloseMenu();
    setNewName("");
    setCreateError(null);
    setDialogOpen(true);
  }

  async function handleCreate() {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    setCreateError(null);
    try {
      const newBranch = await createRevision.mutateAsync({
        sourceBranchId: variantBranchId,
        name: trimmedName,
        resumeId,
      });
      setDialogOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId: newBranch.id },
      });
    } catch {
      setCreateError(t("resume.revisionsMenu.createDialog.error"));
    }
  }

  return (
    <>
      <Badge badgeContent={revisions.length > 0 ? revisions.length : null} color="primary">
        <Button variant="outlined" size="small" onClick={handleOpenMenu}>
          {t("resume.revisionsMenu.label")}
        </Button>
      </Badge>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
        <MenuItem onClick={handleOpenCreateDialog} sx={{ fontStyle: "italic", color: "text.primary" }}>
          {t("resume.revisionsMenu.createRevision")}
        </MenuItem>

        <Divider />

        {revisions.length === 0 ? (
          <MenuItem disabled>{t("resume.revisionsMenu.noRevisions")}</MenuItem>
        ) : (
          revisions.map((branch) => (
            <MenuItem
              key={branch.id}
              onClick={() => {
                handleCloseMenu();
                void navigate({
                  to: "/resumes/$id/branch/$branchId",
                  params: { id: resumeId, branchId: branch.id },
                });
              }}
            >
              {branch.name}
            </MenuItem>
          ))
        )}
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("resume.revisionsMenu.createDialog.title")}</DialogTitle>
        <DialogContent>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={t("resume.revisionsMenu.createDialog.nameLabel")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("resume.revisionsMenu.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!newName.trim() || createRevision.isPending}
            onClick={() => void handleCreate()}
          >
            {createRevision.isPending
              ? t("resume.revisionsMenu.createDialog.creating")
              : t("resume.revisionsMenu.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
