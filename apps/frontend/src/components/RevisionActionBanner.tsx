/**
 * RevisionActionBanner — shown when viewing a revision branch.
 * Consolidates exits into three actions: Review & accept, Keep editing, Discard.
 *
 * "Review & accept" opens a dialog offering the primary accept (merge into
 * source) and a secondary "Save as separate version" (promote) option.
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
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  useDeleteResumeBranch,
  useMergeRevisionIntoSource,
  usePromoteRevisionToVariant,
} from "../hooks/versioning";

interface RevisionActionBannerProps {
  resumeId: string;
  branchId: string;
  /** Name of the source variant branch (for display in button labels). */
  sourceName: string;
  /** ID of the source variant — used to navigate home after discarding. */
  sourceBranchId: string | null;
}

export function RevisionActionBanner({
  resumeId,
  branchId,
  sourceName,
  sourceBranchId,
}: RevisionActionBannerProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const mergeIntoSource = useMergeRevisionIntoSource();
  const promoteToVariant = usePromoteRevisionToVariant();
  const deleteBranch = useDeleteResumeBranch();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [saveAsSeparateOpen, setSaveAsSeparateOpen] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  const busy =
    mergeIntoSource.isPending || promoteToVariant.isPending || deleteBranch.isPending;

  function openReview() {
    setAcceptError(null);
    setSaveError(null);
    setVariantName("");
    setSaveAsSeparateOpen(false);
    setReviewOpen(true);
  }

  async function handleAccept() {
    setAcceptError(null);
    try {
      const data = await mergeIntoSource.mutateAsync({ branchId, resumeId });
      setReviewOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId: data.mergedIntoBranchId },
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("CONFLICT")) {
        setAcceptError(t("resume.revisionBanner.reviewDialog.acceptConflictError"));
      } else {
        setAcceptError(t("resume.revisionBanner.reviewDialog.acceptError"));
      }
    }
  }

  async function handleSaveAsSeparate() {
    setSaveError(null);
    try {
      await promoteToVariant.mutateAsync({
        branchId,
        name: variantName.trim(),
        resumeId,
      });
      setReviewOpen(false);
      await navigate({
        to: "/resumes/$id/branch/$branchId",
        params: { id: resumeId, branchId },
      });
    } catch {
      setSaveError(t("resume.revisionBanner.reviewDialog.saveError"));
    }
  }

  function handleKeepEditing() {
    void navigate({
      to: "/resumes/$id/edit/branch/$branchId",
      params: { id: resumeId, branchId },
    });
  }

  async function handleDiscard() {
    setDiscardError(null);
    try {
      await deleteBranch.mutateAsync({ branchId });
      setDiscardOpen(false);
      if (sourceBranchId) {
        await navigate({
          to: "/resumes/$id/branch/$branchId",
          params: { id: resumeId, branchId: sourceBranchId },
        });
      } else {
        await navigate({ to: "/resumes/$id", params: { id: resumeId } });
      }
    } catch {
      setDiscardError(t("resume.revisionBanner.discardDialog.error"));
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
              variant="outlined"
              disabled={busy}
              onClick={openReview}
            >
              {t("resume.revisionBanner.reviewButton")}
            </Button>
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={handleKeepEditing}
            >
              {t("resume.revisionBanner.keepEditingButton")}
            </Button>
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={() => {
                setDiscardError(null);
                setDiscardOpen(true);
              }}
            >
              {t("resume.revisionBanner.discardButton")}
            </Button>
          </Box>
        }
      >
        <AlertTitle>{t("resume.revisionBanner.title")}</AlertTitle>
        {t("resume.revisionBanner.description", { sourceName })}
      </Alert>

      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("resume.revisionBanner.reviewDialog.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("resume.revisionBanner.reviewDialog.description", { sourceName })}
          </DialogContentText>
          {acceptError && (
            <Typography variant="body2" sx={{ color: "error.main", mb: 1 }}>
              {acceptError}
            </Typography>
          )}
          {saveAsSeparateOpen && (
            <Box sx={{ mt: 1 }}>
              {saveError && (
                <Typography variant="body2" sx={{ color: "error.main", mb: 1 }}>
                  {saveError}
                </Typography>
              )}
              <TextField
                autoFocus
                label={t("resume.revisionBanner.reviewDialog.nameLabel")}
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                fullWidth
                sx={{ mt: 1 }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                <Button
                  variant="contained"
                  disabled={!variantName.trim() || busy}
                  onClick={() => void handleSaveAsSeparate()}
                >
                  {promoteToVariant.isPending
                    ? t("resume.revisionBanner.reviewDialog.saving")
                    : t("resume.revisionBanner.reviewDialog.save")}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button
            onClick={() => setSaveAsSeparateOpen((open) => !open)}
            disabled={busy}
          >
            {t("resume.revisionBanner.reviewDialog.saveAsSeparate")}
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={() => setReviewOpen(false)} disabled={busy}>
              {t("resume.revisionBanner.reviewDialog.cancel")}
            </Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => void handleAccept()}
            >
              {mergeIntoSource.isPending
                ? t("resume.revisionBanner.reviewDialog.accepting")
                : t("resume.revisionBanner.reviewDialog.acceptButton", { sourceName })}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("resume.revisionBanner.discardDialog.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("resume.revisionBanner.discardDialog.description")}
          </DialogContentText>
          {discardError && (
            <Typography variant="body2" sx={{ color: "error.main", mt: 1 }}>
              {discardError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)} disabled={busy}>
            {t("resume.revisionBanner.discardDialog.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => void handleDiscard()}
          >
            {deleteBranch.isPending
              ? t("resume.revisionBanner.discardDialog.discarding")
              : t("resume.revisionBanner.discardDialog.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
