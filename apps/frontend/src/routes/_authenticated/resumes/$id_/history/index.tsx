/**
 * /resumes/$id/history — Version History page.
 *
 * Hybrid split-view: branch sidebar (left) + branch graph (center) + commit detail panel (right).
 *
 * Data: useResumeBranchHistoryGraph(resumeId) from hooks/versioning
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { z } from "zod";
import { useState } from "react";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import {
  useArchiveResumeBranch,
  useDeleteResumeBranch,
  useFinaliseResumeBranch,
  useResumeBranchHistoryGraph,
  useRevertResumeCommit,
} from "../../../../../hooks/versioning";
import { RevertDialog } from "../../../../../components/RevertDialog";
import type { GraphCommit } from "./history-graph-utils";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../../../components/feedback";
import { getReachableCommitIds, getReachableCommits, sortByCreatedAt } from "./history-graph-utils";
import { HistoryCommitTable } from "./HistoryCommitTable";
import { HistoryBranchGraph } from "./HistoryBranchGraph";
import { HistoryBranchSidebar } from "./HistoryBranchSidebar";

export const Route = createFileRoute("/_authenticated/resumes/$id_/history/")({
  validateSearch: z.object({
    branchId: z.string().optional(),
  }),
  component: HistoryIndexRoute,
});

export function VersionHistoryPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeTargetBranchId, setMergeTargetBranchId] = useState("");
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: branchIdFromSearch } =
    useSearch({ strict: false }) as { branchId?: string };
  const { data: graph, isLoading, isError } = useResumeBranchHistoryGraph(resumeId);
  const finaliseResumeBranch = useFinaliseResumeBranch();
  const deleteResumeBranch = useDeleteResumeBranch();
  const revertCommit = useRevertResumeCommit();
  const { mutate: archiveBranch, isError: isArchiveError } = useArchiveResumeBranch();
  const [revertTarget, setRevertTarget] = useState<GraphCommit | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  const branches = graph?.branches ?? [];
  const graphCommits = graph?.commits ?? [];
  const graphEdges = graph?.edges ?? [];

  const selectedBranch =
    branches.find((branch) => branch.id === branchIdFromSearch) ??
    branches.find((branch) => branch.isMain) ??
    branches[0];
  const mainBranch = branches.find((branch) => branch.isMain);
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const mergedCommitIds = getReachableCommitIds(mainBranch?.headCommitId ?? null, graphEdges);
  const commits = sortByCreatedAt(
    getReachableCommits(selectedBranch?.headCommitId ?? null, graphCommits, graphEdges),
  ).reverse();
  const mergeTargetBranches = branches.filter((branch) => branch.id !== selectedBranchId);
  const canMergeSelectedBranch = Boolean(
    selectedBranch && !selectedBranch.isMain && selectedBranch.headCommitId && mergeTargetBranches.length > 0,
  );
  const canDeleteSelectedBranch = Boolean(selectedBranch && !selectedBranch.isMain);

  function navigateToHistory(branchId: string | undefined) {
    return navigate({
      to: "/resumes/$id/history",
      params: { id: resumeId },
      search: branchId ? { branchId } : {},
    });
  }

  function openMergeDialog() {
    const firstTargetBranchId = mergeTargetBranches[0]?.id ?? "";
    setMergeTargetBranchId(firstTargetBranchId);
    setMergeDialogOpen(true);
  }

  async function handleMergeSelectedBranch() {
    if (!selectedBranchId || !mergeTargetBranchId || selectedBranchId === mergeTargetBranchId) {
      return;
    }

    await finaliseResumeBranch.mutateAsync({
      sourceBranchId: mergeTargetBranchId,
      revisionBranchId: selectedBranchId,
      action: "merge",
    });

    setMergeDialogOpen(false);
    await navigateToHistory(mergeTargetBranchId);
  }

  async function handleDeleteSelectedBranch() {
    if (!selectedBranchId || !selectedBranch || selectedBranch.isMain) {
      return;
    }

    await deleteResumeBranch.mutateAsync({ branchId: selectedBranchId });
    setDeleteDialogOpen(false);
    await navigateToHistory(mainBranchId || undefined);
  }

  async function handleOpenCompare() {
    if (
      selectedBranch &&
      mainBranch &&
      selectedBranch.name !== mainBranch.name &&
      selectedBranch.headCommitId &&
      mainBranch.headCommitId
    ) {
      await navigate({
        to: "/resumes/$id/compare",
        params: { id: resumeId },
        search: { baseRef: mainBranch.name, compareRef: selectedBranch.name },
      });
      return;
    }

    await navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
    });
  }

  function handleViewCommit(commitId: string) {
    void navigate({
      to: "/resumes/$id/commit/$commitId",
      params: { id: resumeId, commitId },
    });
  }

  function handleRequestRevert(commit: GraphCommit) {
    setRevertError(null);
    setRevertTarget(commit);
  }

  async function handleConfirmRevert() {
    if (!revertTarget || !selectedBranchId) return;
    setRevertError(null);
    try {
      await revertCommit.mutateAsync({
        branchId: selectedBranchId,
        targetCommitId: revertTarget.id,
        resumeId,
      });
      setRevertTarget(null);
    } catch {
      setRevertError(t("resume.revertDialog.error"));
    }
  }

  function handleCompareCommit(commitId: string) {
    const branchName = selectedBranch?.name;
    void navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
      search: branchName
        ? { baseRef: commitId, compareRef: branchName }
        : { baseRef: commitId },
    });
  }

  function handleViewSelectedBranchInResume() {
    if (!selectedBranchId) {
      return;
    }

    void navigate({
      to: "/resumes/$id/branch/$branchId",
      params: { id: resumeId, branchId: selectedBranchId },
    });
  }

  if (isLoading) return <LoadingState label={t("resume.history.loading")} />;
  if (isError) return <ErrorState message={t("resume.history.error")} />;

  return (
    <>
      <PageHeader
        title={t("resume.history.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <PageContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("resume.history.description")}
        </Typography>

        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            size="small"
            disabled={!canMergeSelectedBranch}
            onClick={openMergeDialog}
          >
            {t("resume.history.mergeButton")}
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            disabled={!canDeleteSelectedBranch}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t("resume.history.deleteBranchButton")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleOpenCompare()}
          >
            {t("resume.history.compareButton")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleViewSelectedBranchInResume}
          >
            {t("resume.history.viewInResumeButton")}
          </Button>
        </Box>

        {isArchiveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("resume.history.archiveError", { defaultValue: "Failed to update version. Please try again." })}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", minHeight: 0 }}>
          <HistoryBranchSidebar
            branches={branches}
            selectedBranchId={selectedBranchId}
            onSelect={(branchId) => void navigateToHistory(branchId)}
            onArchive={(branchId, isArchived) =>
              archiveBranch({ branchId, isArchived, resumeId })
            }
          />

          <Box sx={{ flex: 1, minWidth: 0, overflow: "auto", maxWidth: "50%" }}>
            <HistoryBranchGraph
              branches={branches}
              graphCommits={graphCommits}
              graphEdges={graphEdges}
              selectedBranchId={selectedBranchId}
              onViewCommit={handleViewCommit}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: "50%" }}>
            <HistoryCommitTable
              commits={commits}
              selectedBranch={selectedBranch}
              onViewCommit={handleViewCommit}
              onCompare={handleCompareCommit}
              onRevert={handleRequestRevert}
            />
          </Box>
        </Box>

        <Dialog
          open={mergeDialogOpen}
          onClose={() => !finaliseResumeBranch.isPending && setMergeDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{t("resume.history.mergeDialog.title")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedBranch
                ? t("resume.history.mergeDialog.message", { branchName: selectedBranch.name })
                : null}
            </Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>{t("resume.history.mergeDialog.targetLabel")}</InputLabel>
              <Select
                value={mergeTargetBranchId}
                label={t("resume.history.mergeDialog.targetLabel")}
                onChange={(event) => setMergeTargetBranchId(event.target.value)}
              >
                {mergeTargetBranches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {finaliseResumeBranch.isError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t("resume.history.mergeDialog.error")}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMergeDialogOpen(false)} disabled={finaliseResumeBranch.isPending}>
              {t("resume.history.mergeDialog.cancel")}
            </Button>
            <Button
              onClick={() => void handleMergeSelectedBranch()}
              variant="contained"
              disabled={!mergeTargetBranchId || mergeTargetBranchId === selectedBranchId || finaliseResumeBranch.isPending}
            >
              {finaliseResumeBranch.isPending
                ? t("resume.history.mergeDialog.merging")
                : t("resume.history.mergeDialog.confirm")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleteResumeBranch.isPending && setDeleteDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{t("resume.history.deleteDialog.title")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {selectedBranch
                ? t("resume.history.deleteDialog.message", { branchName: selectedBranch.name })
                : null}
            </Typography>
            {deleteResumeBranch.isError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t("resume.history.deleteDialog.error")}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteResumeBranch.isPending}>
              {t("resume.history.deleteDialog.cancel")}
            </Button>
            <Button
              onClick={() => void handleDeleteSelectedBranch()}
              color="error"
              variant="contained"
              disabled={deleteResumeBranch.isPending}
            >
              {deleteResumeBranch.isPending
                ? t("resume.history.deleteDialog.deleting")
                : t("resume.history.deleteDialog.confirm")}
            </Button>
          </DialogActions>
        </Dialog>

        <RevertDialog
          open={revertTarget !== null}
          targetLabel={
            revertTarget
              ? revertTarget.title || t("resume.history.defaultMessage")
              : ""
          }
          isPending={revertCommit.isPending}
          error={revertError}
          onClose={() => {
            if (!revertCommit.isPending) setRevertTarget(null);
          }}
          onConfirm={handleConfirmRevert}
        />
      </PageContent>
    </>
  );
}

function HistoryIndexRoute() {
  return <VersionHistoryPage />;
}
