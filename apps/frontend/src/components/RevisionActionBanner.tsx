/**
 * RevisionActionBanner — shown when viewing a revision branch.
 * Offers two actions: merge into the source variant, or promote to a standalone variant.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMergeRevisionIntoSource, usePromoteRevisionToVariant } from "../hooks/versioning";

interface RevisionActionBannerProps {
  resumeId: string;
  branchId: string;
  /** Name of the source variant branch (for display in button labels). */
  sourceName: string;
}

export function RevisionActionBanner({ resumeId, branchId, sourceName }: RevisionActionBannerProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const mergeIntoSource = useMergeRevisionIntoSource();
  const promoteToVariant = usePromoteRevisionToVariant();

  const [mergeError, setMergeError] = useState<string | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [promoteError, setPromoteError] = useState<string | null>(null);

  async function handleMerge() {
    setMergeError(null);
    try {
      const data = await mergeIntoSource.mutateAsync({ branchId, resumeId });
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId: data.mergedIntoBranchId },
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("CONFLICT")) {
        setMergeError(t("resume.revisionBanner.mergeConflictError"));
      } else {
        setMergeError(t("resume.revisionBanner.mergeError"));
      }
    }
  }

  function openPromoteDialog() {
    setVariantName("");
    setPromoteError(null);
    setPromoteDialogOpen(true);
  }

  async function handlePromote() {
    setPromoteError(null);
    try {
      await promoteToVariant.mutateAsync({ branchId, name: variantName.trim(), resumeId });
      setPromoteDialogOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId },
      });
    } catch {
      setPromoteError(t("resume.revisionBanner.promoteDialog.error"));
    }
  }

  return (
    <>
      <Alert
        severity="info"
        action={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              color="inherit"
              size="small"
              disabled={mergeIntoSource.isPending || promoteToVariant.isPending}
              onClick={() => void handleMerge()}
            >
              {mergeIntoSource.isPending
                ? t("resume.revisionBanner.merging")
                : t("resume.revisionBanner.mergeButton", { sourceName })}
            </Button>
            <Button
              color="inherit"
              size="small"
              disabled={mergeIntoSource.isPending || promoteToVariant.isPending}
              onClick={openPromoteDialog}
            >
              {t("resume.revisionBanner.promoteButton")}
            </Button>
          </Box>
        }
      >
        <AlertTitle>{t("resume.revisionBanner.title")}</AlertTitle>
        {t("resume.revisionBanner.description", { sourceName })}
      </Alert>
      {mergeError && (
        <Typography variant="body2" sx={{ color: "error.main", mt: 0.5 }}>
          {mergeError}
        </Typography>
      )}

      <Dialog open={promoteDialogOpen} onClose={() => setPromoteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("resume.revisionBanner.promoteDialog.title")}</DialogTitle>
        <DialogContent>
          {promoteError && (
            <Typography variant="body2" sx={{ color: "error.main", mb: 1 }}>
              {promoteError}
            </Typography>
          )}
          <TextField
            autoFocus
            label={t("resume.revisionBanner.promoteDialog.nameLabel")}
            value={variantName}
            onChange={(e) => setVariantName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteDialogOpen(false)}>
            {t("resume.revisionBanner.promoteDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!variantName.trim() || promoteToVariant.isPending}
            onClick={() => void handlePromote()}
          >
            {promoteToVariant.isPending
              ? t("resume.revisionBanner.promoteDialog.promoting")
              : t("resume.revisionBanner.promoteDialog.promote")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
