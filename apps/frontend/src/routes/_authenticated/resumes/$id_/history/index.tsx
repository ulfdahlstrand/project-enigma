/**
 * /resumes/$id/history — Version History page.
 *
 * Lists commits for a selected branch and lets the user toggle to a
 * resume-wide branch overview mode.
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
import ButtonGroup from "@mui/material/ButtonGroup";
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
  useDeleteResumeBranch,
  useFinaliseResumeBranch,
  useResumeBranchHistoryGraph,
} from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../../../components/feedback";
import { getReachableCommits, sortByCreatedAt } from "./history-graph-utils";
import { HistoryCommitTable } from "./HistoryCommitTable";
import { HistoryBranchGraph } from "./HistoryBranchGraph";

export const Route = createFileRoute("/_authenticated/resumes/$id_/history/")({
  validateSearch: z.object({
    view: z.enum(["list", "tree"]).optional(),
  }),
  component: HistoryIndexRoute,
});

export function VersionHistoryPage({ forcedBranchId }: { forcedBranchId?: string } = {}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeTargetBranchId, setMergeTargetBranchId] = useState("");
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { view: viewFromSearch } =
    useSearch({ strict: false }) as { view?: "list" | "tree" };
  const { data: graph, isLoading, isError } = useResumeBranchHistoryGraph(resumeId);
  const finaliseResumeBranch = useFinaliseResumeBranch();
  const deleteResumeBranch = useDeleteResumeBranch();

  const branches = graph?.branches ?? [];
  const graphCommits = graph?.commits ?? [];
  const graphEdges = graph?.edges ?? [];

  const selectedBranch =
    branches.find((branch) => branch.id === forcedBranchId) ??
    branches.find((branch) => branch.isMain) ??
    branches[0];
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const selectedView = viewFromSearch ?? "list";
  const selectedResumeCommitId = selectedBranch?.headCommitId ?? selectedBranch?.forkedFromCommitId ?? null;
  const commits = sortByCreatedAt(
    getReachableCommits(selectedBranch?.headCommitId ?? null, graphCommits, graphEdges),
  ).reverse();
  const mergeTargetBranches = branches.filter((branch) => branch.id !== selectedBranchId);
  const canMergeSelectedBranch = Boolean(
    selectedBranch && !selectedBranch.isMain && selectedBranch.headCommitId && mergeTargetBranches.length > 0,
  );
  const canDeleteSelectedBranch = Boolean(selectedBranch && !selectedBranch.isMain);

  function navigateToHistory(branchId: string | undefined, view: "list" | "tree") {
    if (branchId) {
      return navigate({
        to: "/resumes/$id/history/branch/$branchId",
        params: { id: resumeId, branchId },
        search: { view },
      });
    }

    return navigate({
      to: "/resumes/$id/history",
      params: { id: resumeId },
      search: { view },
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
    await navigateToHistory(mergeTargetBranchId, selectedView);
  }

  async function handleDeleteSelectedBranch() {
    if (!selectedBranchId || !selectedBranch || selectedBranch.isMain) {
      return;
    }

    await deleteResumeBranch.mutateAsync({ branchId: selectedBranchId });
    setDeleteDialogOpen(false);
    await navigateToHistory(mainBranchId || undefined, selectedView);
  }

  function handleViewCommit(commitId: string) {
    void navigate({
      to: "/resumes/$id/commit/$commitId",
      params: { id: resumeId, commitId },
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

        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>{t("resume.history.branchLabel")}</InputLabel>
              <Select
                value={selectedBranchId}
                label={t("resume.history.branchLabel")}
                onChange={(event) =>
                  void navigateToHistory(event.target.value, selectedView)
                }
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ButtonGroup variant="outlined" size="small">
              <Button
                variant={selectedView === "list" ? "contained" : "outlined"}
                onClick={() =>
                  void navigateToHistory(selectedBranchId || undefined, "list")
                }
              >
                {t("resume.history.listView")}
              </Button>
              <Button
                variant={selectedView === "tree" ? "contained" : "outlined"}
                onClick={() =>
                  void navigateToHistory(selectedBranchId || undefined, "tree")
                }
              >
                {t("resume.history.treeView")}
              </Button>
            </ButtonGroup>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
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
              onClick={() =>
                void navigate({ to: "/resumes/$id/compare", params: { id: resumeId } })
              }
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
        </Box>

        {selectedView === "tree" ? (
          <HistoryBranchGraph
            branches={branches}
            graphCommits={graphCommits}
            graphEdges={graphEdges}
            selectedBranchId={selectedBranchId}
            onViewCommit={handleViewCommit}
          />
        ) : (
          <HistoryCommitTable
            commits={commits}
            selectedBranch={selectedBranch}
            onViewCommit={handleViewCommit}
          />
        )}

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
      </PageContent>
    </>
  );
}

function HistoryIndexRoute() {
  return <VersionHistoryPage />;
}
