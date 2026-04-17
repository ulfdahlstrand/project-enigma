/**
 * ResumeDetailShell — outer chrome for the resume detail/edit pages.
 *
 * Renders the page header (with breadcrumbs), the ResumeContextStrip (variant,
 * language, draft-status, stale/revision pills), stale/revision action banners,
 * the workspace slot, the status bar, the revision review dialog, and the
 * "create variant" dialog.
 */
import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PageHeader } from "../../layout/PageHeader";
import { RevisionActionBanner } from "../../RevisionActionBanner";
import { TranslationStalenessBanner } from "../TranslationStalenessBanner";
import { ResumeContextStrip } from "../context-strip/ResumeContextStrip";
import { useListCommitTags } from "../../../hooks/versioning";
import { ResumeRevisionReviewDialog } from "../ResumeRevisionReviewDialog";
import { ResumeCommandBar } from "../command-bar/ResumeCommandBar";
import type { ResumeDetailPageBundle } from "./useResumeDetailPage";

interface ResumeDetailShellProps {
  bundle: ResumeDetailPageBundle;
  toolbarActions: ReactNode;
  children: ReactNode;
}

export function ResumeDetailShell({
  bundle,
  toolbarActions,
  children,
}: ResumeDetailShellProps) {
  const {
    id,
    t,
    navigate,
    resume,
    employee,
    activeBranchId,
    activeBranch,
    activeBranchType,
    variantBranchId,
    sourceBranch,
    mergedCommitIds,
    resumeTitle,
    inlineRevision,
    isEditRoute,
    createVariantDialogOpen,
    setCreateVariantDialogOpen,
    newVariantName,
    setNewVariantName,
    createVariantError,
    setCreateVariantError,
    handleCreateVariant,
    forkBranchIsPending,
    language,
    activeBranchName,
    branches,
    draftTitle,
    consultantTitle,
    draftPresentation,
    presentationText,
    draftSummary,
    summary,
    draftHighlightedItems,
    highlightedItemsText,
  } = bundle;

  const { data: commitTags } = useListCommitTags(id);
  // Find the source resume for this resume (where this resume is the translation target)
  const incomingTag = commitTags?.find((tag) => tag.target.resumeId === id);
  const sourceResumeIdForBanner = incomingTag?.source.resumeId ?? null;
  const sourceNameForBanner = incomingTag?.source.resumeTitle ?? "";
  const targetHeadCommitId = activeBranch?.headCommitId ?? null;

  function handleAddVariant() {
    setNewVariantName("");
    setCreateVariantError(null);
    setCreateVariantDialogOpen(true);
  }

  return (
    <Box
      sx={{
        height: inlineRevision.isOpen ? "100vh" : undefined,
        display: inlineRevision.isOpen ? "flex" : "block",
        flexDirection: inlineRevision.isOpen ? "column" : undefined,
        overflow: inlineRevision.isOpen ? "hidden" : undefined,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "clip",
      }}
    >
      <PageHeader
        title={resumeTitle}
        breadcrumbs={[
          { label: t("nav.employees"), to: "/employees" },
          ...(resume?.employeeId
            ? [
                { label: employee?.name ?? "…", to: `/employees/${resume.employeeId}` },
                { label: t("nav.resumes"), to: `/resumes?employeeId=${resume.employeeId}` },
              ]
            : []),
          {
            node: (
              <Typography variant="caption" color="text.primary">
                {resumeTitle}
              </Typography>
            ),
            key: "resume-title",
          },
        ]}
        hideTitleBreadcrumb
        actions={toolbarActions}
      />

      <ResumeContextStrip
        bundle={{
          id,
          isEditRoute,
          branches,
          activeBranchId,
          activeBranch,
          activeBranchType,
          activeBranchName,
          variantBranchId,
          sourceBranch,
          mergedCommitIds,
          draftTitle,
          consultantTitle,
          draftPresentation,
          presentationText,
          draftSummary,
          summary,
          draftHighlightedItems,
          highlightedItemsText,
          navigate,
        }}
        onAddVariant={handleAddVariant}
      />

      {sourceResumeIdForBanner ? (
        <TranslationStalenessBanner
          sourceResumeId={sourceResumeIdForBanner}
          targetResumeId={id}
          targetHeadCommitId={targetHeadCommitId}
          sourceName={sourceNameForBanner}
        />
      ) : null}
      {activeBranchType === "revision" && activeBranchId ? (
        <RevisionActionBanner
          resumeId={id}
          branchId={activeBranchId}
          sourceName={sourceBranch?.name ?? ""}
          sourceBranchId={sourceBranch?.id ?? null}
        />
      ) : null}

      {children}

      <ResumeCommandBar bundle={bundle} />
      <ResumeRevisionReviewDialog reviewDialog={inlineRevision.reviewDialog} />

      <Dialog
        open={createVariantDialogOpen}
        onClose={() => !forkBranchIsPending && setCreateVariantDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("resume.variants.createDialog.title")}</DialogTitle>
        <DialogContent>
          {createVariantError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createVariantError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={t("resume.variants.createDialog.nameLabel")}
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateVariant(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateVariantDialogOpen(false)}
            disabled={forkBranchIsPending}
          >
            {t("resume.variants.createDialog.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={!newVariantName.trim() || forkBranchIsPending}
            onClick={() => void handleCreateVariant()}
          >
            {forkBranchIsPending
              ? t("resume.variants.createDialog.creating")
              : t("resume.variants.createDialog.create")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
