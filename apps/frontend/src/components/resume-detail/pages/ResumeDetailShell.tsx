/**
 * ResumeDetailShell — outer chrome for the resume detail/edit pages.
 *
 * Renders the page header (with breadcrumbs + variant/language dropdowns),
 * stale/revision banners, the workspace slot, the status bar, the revision
 * review dialog, and the "create variant" dialog.
 */
import type { ReactNode } from "react";
import type { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { BreadcrumbDropdown } from "../../layout/BreadcrumbDropdown";
import { PageHeader } from "../../layout/PageHeader";
import { LanguageSwitcher } from "../../LanguageSwitcher";
import { RevisionActionBanner } from "../../RevisionActionBanner";
import { TranslationStaleBanner } from "../../TranslationStaleBanner";
import { ResumeHeaderChip } from "../ResumeHeaderChip";
import { ResumeRevisionReviewDialog } from "../ResumeRevisionReviewDialog";
import { ResumeStatusBar } from "../ResumeStatusBar";
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
    branches,
    resume,
    employee,
    activeBranchId,
    activeBranch,
    activeBranchName,
    activeBranchType,
    variantBranchId,
    sourceBranch,
    mergedCommitIds,
    resumeTitle,
    inlineRevision,
    showSuggestionsPanel,
    showChatPanel,
    isEditRoute,
    zoom,
    minZoom,
    maxZoom,
    setZoom,
    handleToggleSuggestions,
    handleToggleAssistant,
    createVariantDialogOpen,
    setCreateVariantDialogOpen,
    newVariantName,
    setNewVariantName,
    createVariantError,
    setCreateVariantError,
    handleCreateVariant,
    forkBranchIsPending,
  } = bundle;

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
          ...(variantBranchId !== null && branches
            ? buildVariantBreadcrumbs({
                t,
                navigate,
                branches,
                variantBranchId,
                activeBranchName,
                activeBranchId,
                mergedCommitIds,
                resumeId: id,
                onAddVariant: () => {
                  setNewVariantName("");
                  setCreateVariantError(null);
                  setCreateVariantDialogOpen(true);
                },
              })
            : []),
        ]}
        hideTitleBreadcrumb
        chip={<ResumeHeaderChip revisionModeLabel={t("revision.inline.modeChip")} />}
        actions={toolbarActions}
      />
      {activeBranchType === "translation" && activeBranch?.isStale && activeBranchId ? (
        <TranslationStaleBanner resumeId={id} branchId={activeBranchId} />
      ) : null}
      {activeBranchType === "revision" && activeBranchId ? (
        <RevisionActionBanner
          resumeId={id}
          branchId={activeBranchId}
          sourceName={sourceBranch?.name ?? ""}
        />
      ) : null}
      {children}
      <ResumeStatusBar
        isEditing={isEditRoute}
        resumeId={id}
        activeBranchType={activeBranchType}
        variantBranchId={variantBranchId}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        onZoomChange={setZoom}
        isSuggestionsOpen={inlineRevision.isOpen && showSuggestionsPanel}
        onToggleSuggestions={handleToggleSuggestions}
        isAiOpen={inlineRevision.isOpen && showChatPanel && inlineRevision.stage !== "finalize"}
        onToggleAi={handleToggleAssistant}
      />
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

interface VariantBreadcrumbInput {
  t: TFunction;
  navigate: ReturnType<typeof useNavigate>;
  branches: NonNullable<ResumeDetailPageBundle["branches"]>;
  variantBranchId: string;
  activeBranchName: string;
  activeBranchId: string | null;
  mergedCommitIds: Set<string>;
  resumeId: string;
  onAddVariant: () => void;
}

function buildVariantBreadcrumbs({
  t,
  navigate,
  branches,
  variantBranchId,
  activeBranchName,
  activeBranchId,
  mergedCommitIds,
  resumeId,
  onAddVariant,
}: VariantBreadcrumbInput) {
  const variantOptions = branches
    .filter((b) =>
      b.branchType === "variant" &&
      !b.isArchived &&
      !(b.headCommitId !== null && !b.isMain && mergedCommitIds.has(b.headCommitId))
    )
    .map((b) => ({ id: b.id, label: b.name }));
  const variantBranch = branches.find((b) => b.id === variantBranchId);
  return [
    {
      key: "branch",
      node: (
        <BreadcrumbDropdown
          label={variantBranch?.name ?? activeBranchName}
          options={variantOptions}
          onSelect={(branchId) =>
            void navigate({
              to: "/resumes/$id/branch/$branchId",
              params: { id: resumeId, branchId },
            })
          }
          isCurrentPage
          addLabel={t("resume.variants.addVariant")}
          onAdd={onAddVariant}
        />
      ),
    },
    {
      key: "language",
      node: (
        <LanguageSwitcher
          resumeId={resumeId}
          currentBranchId={activeBranchId}
          variantBranchId={variantBranchId}
          ghost
        />
      ),
    },
  ];
}
