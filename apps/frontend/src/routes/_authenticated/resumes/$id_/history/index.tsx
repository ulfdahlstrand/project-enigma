/**
 * /resumes/$id/history — Version History page.
 *
 * Layout: HistoryFilterSidebar (left, 220px) + main area (toolbar + inline-graph table).
 * The standalone HistoryBranchGraph canvas has been replaced by an inline SVG column
 * within HistoryCommitTable.
 *
 * Data: useResumeBranchHistoryGraph(resumeId)
 * i18n: useTranslation("common")
 * Styling: MUI sx prop + compare-design.ts tokens
 */
import { z } from "zod";
import { useMemo, useState } from "react";
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
  useListCommitTags,
  useResumeBranchHistoryGraph,
  useRevertResumeCommit,
} from "../../../../../hooks/versioning";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";
import { RevertDialog } from "../../../../../components/RevertDialog";
import type { GraphCommit } from "./history-graph-utils";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";
import { ResumeWorkbenchTabs } from "../../../../../components/resume-detail/ResumeWorkbenchTabs";
import { LoadingState, ErrorState } from "../../../../../components/feedback";
import { sortByCreatedAt, getReachableCommitIds } from "./history-graph-utils";
import {
  filterBranches,
  filterGraphData,
  type BranchFilterType,
} from "./HistoryBranchFilters";
import { HistoryCommitTable } from "./HistoryCommitTable";
import {
  HistoryFilterSidebar,
  type HistoryFilterState,
  type CommitTypeFilter,
} from "./HistoryFilterSidebar";
import { computeInlineGraphData } from "./history-inline-graph";
import { fg, font, ink, line } from "../compare/compare-design";

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
  const { data: commitTags } = useListCommitTags(resumeId);
  const finaliseResumeBranch = useFinaliseResumeBranch();
  const deleteResumeBranch = useDeleteResumeBranch();
  const revertCommit = useRevertResumeCommit();
  const { mutate: archiveBranch, isError: isArchiveError } = useArchiveResumeBranch();
  const [revertTarget, setRevertTarget] = useState<GraphCommit | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<BranchFilterType>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterState>({
    variantBranchId: null,
    commitType: "all",
  });

  function toggleFilter(filter: BranchFilterType) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  const branches = graph?.branches ?? [];
  const graphCommits = graph?.commits ?? [];
  const graphEdges = graph?.edges ?? [];
  const tags = commitTags ?? [];

  const commitTagsMap = useMemo(() => {
    const map = new Map<string, CommitTagWithLinkedResume[]>();
    tags.forEach((tag) => {
      [tag.sourceCommitId, tag.targetCommitId].forEach((commitId) => {
        const existing = map.get(commitId) ?? [];
        map.set(commitId, [...existing, tag]);
      });
    });
    return map;
  }, [tags]);

  const taggedBranchIds = useMemo(() => {
    const tagged = new Set<string>();
    branches.forEach((branch) => {
      if (!branch.headCommitId) return;
      if ((commitTagsMap.get(branch.headCommitId) ?? []).length > 0) tagged.add(branch.id);
    });
    return tagged;
  }, [branches, commitTagsMap]);

  const filteredBranches = useMemo(
    () => filterBranches({ branches, activeFilters, showArchived, taggedBranchIds }),
    [branches, activeFilters, showArchived, taggedBranchIds],
  );

  const filteredGraph = useMemo(
    () => filterGraphData({ branches, commits: graphCommits, edges: graphEdges, filteredBranches }),
    [branches, graphCommits, graphEdges, filteredBranches],
  );

  // Inline graph data — all visible commits with lane assignments
  const inlineGraphData = useMemo(
    () => computeInlineGraphData(filteredBranches, filteredGraph.commits, filteredGraph.edges),
    [filteredBranches, filteredGraph.commits, filteredGraph.edges],
  );

  // Set of merge commit IDs (have parentOrder > 0 edges)
  const mergeCommitIds = useMemo(() => {
    const ids = new Set<string>();
    filteredGraph.edges.filter((e) => e.parentOrder > 0).forEach((e) => ids.add(e.commitId));
    return ids;
  }, [filteredGraph.edges]);

  // Apply variant + type filters to produce the visible rows
  const visibleRows = useMemo(() => {
    // Sort all commits newest first
    const allSorted = sortByCreatedAt(filteredGraph.commits).reverse();

    let filtered = allSorted;

    // Variant filter — show only commits reachable from the selected branch
    if (historyFilter.variantBranchId !== null) {
      const targetBranch = filteredBranches.find((b) => b.id === historyFilter.variantBranchId);
      if (targetBranch?.headCommitId) {
        const reachable = getReachableCommitIds(targetBranch.headCommitId, filteredGraph.edges);
        filtered = filtered.filter((c) => reachable.has(c.id));
      }
    }

    // Type filter
    if (historyFilter.commitType === "merges") {
      filtered = filtered.filter((c) => mergeCommitIds.has(c.id));
    } else if (historyFilter.commitType === "changes") {
      filtered = filtered.filter((c) => !mergeCommitIds.has(c.id));
    }

    // Map back to rowIndex in the full inlineGraphData.rows array
    return filtered.map((commit) => {
      const row = inlineGraphData.rows.find((r) => r.commit.id === commit.id);
      return { commit, rowIndex: row?.rowIndex ?? 0 };
    });
  }, [
    filteredGraph.commits,
    filteredGraph.edges,
    filteredBranches,
    historyFilter,
    mergeCommitIds,
    inlineGraphData.rows,
  ]);

  // Per-branch commit counts for the filter sidebar
  const commitCountByBranchId = useMemo(() => {
    const counts = new Map<string, number>();
    filteredBranches.forEach((branch) => {
      if (!branch.headCommitId) return;
      const reachable = getReachableCommitIds(branch.headCommitId, filteredGraph.edges);
      counts.set(branch.id, reachable.size);
    });
    return counts;
  }, [filteredBranches, filteredGraph.edges]);

  // Selected branch (for head badge + action dialogs)
  const selectedBranch =
    branches.find((b) => b.id === (historyFilter.variantBranchId ?? branchIdFromSearch)) ??
    branches.find((b) => b.isMain) ??
    branches[0];
  const mainBranch = branches.find((b) => b.isMain);
  const mainBranchId = mainBranch?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const mergeTargetBranches = branches.filter((b) => b.id !== selectedBranchId);

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
    setMergeTargetBranchId(mergeTargetBranches[0]?.id ?? "");
    setMergeDialogOpen(true);
  }

  async function handleMergeSelectedBranch() {
    if (!selectedBranchId || !mergeTargetBranchId || selectedBranchId === mergeTargetBranchId) return;
    await finaliseResumeBranch.mutateAsync({
      sourceBranchId: mergeTargetBranchId,
      revisionBranchId: selectedBranchId,
      action: "merge",
    });
    setMergeDialogOpen(false);
    await navigateToHistory(mergeTargetBranchId);
  }

  async function handleDeleteSelectedBranch() {
    if (!selectedBranchId || !selectedBranch || selectedBranch.isMain) return;
    await deleteResumeBranch.mutateAsync({ branchId: selectedBranchId });
    setDeleteDialogOpen(false);
    await navigateToHistory(mainBranchId || undefined);
  }

  async function handleOpenCompare() {
    if (selectedBranch && mainBranch && selectedBranch.name !== mainBranch.name &&
        selectedBranch.headCommitId && mainBranch.headCommitId) {
      await navigate({
        to: "/resumes/$id/compare",
        params: { id: resumeId },
        search: { baseRef: mainBranch.name, compareRef: selectedBranch.name },
      });
      return;
    }
    await navigate({ to: "/resumes/$id/compare", params: { id: resumeId } });
  }

  function handleViewCommit(commitId: string) {
    void navigate({ to: "/resumes/$id/commit/$commitId", params: { id: resumeId, commitId } });
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
      search: branchName ? { baseRef: commitId, compareRef: branchName } : { baseRef: commitId },
    });
  }

  if (isLoading) return <LoadingState label={t("resume.history.loading")} />;
  if (isError) return <ErrorState message={t("resume.history.error")} />;

  const totalCommitCount = filteredGraph.commits.length;
  const mergeCount = mergeCommitIds.size;

  return (
    <>
      <PageHeader
        title={t("resume.history.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <ResumeWorkbenchTabs
        resumeId={resumeId}
        activeBranchId={branchIdFromSearch ?? null}
        compareRef={branches.find((b) => b.id === branchIdFromSearch)?.name ?? null}
      />
      <PageContent>
        {isArchiveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("resume.history.archiveError", { defaultValue: "Failed to update version. Please try again." })}
          </Alert>
        )}

        {/* Two-column layout: filter sidebar + main area */}
        <Box sx={{ display: "flex", gap: 0, alignItems: "flex-start", minHeight: 0 }}>

          {/* ── Filter sidebar ── */}
          <HistoryFilterSidebar
            branches={filteredBranches}
            commitCountByBranchId={commitCountByBranchId}
            totalCommitCount={totalCommitCount}
            mergeCommitCount={mergeCount}
            filterState={historyFilter}
            onFilterChange={setHistoryFilter}
          />

          {/* ── Main area ── */}
          <Box sx={{ flex: 1, minWidth: 0, paddingLeft: "24px", overflowX: "auto" }}>

            {/* Toolbar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "12px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <Box
                sx={{
                  fontFamily: font.ui,
                  fontSize: "12px",
                  color: fg[4],
                }}
              >
                {t("resume.history.showingEvents", {
                  defaultValue: "Visar {{count}} händelser",
                  count: visibleRows.length,
                })}
              </Box>
              <Box sx={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                <Button variant="outlined" size="small" onClick={() => void handleOpenCompare()}>
                  {t("resume.history.compareButton")}
                </Button>
              </Box>
            </Box>

            {/* Commit table with inline graph */}
            <Box
              sx={{
                background: ink[0],
                border: `1px solid ${line[1]}`,
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <HistoryCommitTable
                rows={visibleRows}
                inlineGraphData={inlineGraphData}
                selectedBranch={selectedBranch}
                commitTags={commitTagsMap}
                currentResumeId={resumeId}
                mergeCommitIds={mergeCommitIds}
                onViewCommit={handleViewCommit}
                onCompare={handleCompareCommit}
                onRevert={handleRequestRevert}
              />
            </Box>
          </Box>
        </Box>

        {/* ── Dialogs ── */}
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
            {finaliseResumeBranch.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t("resume.history.mergeDialog.error")}
              </Alert>
            )}
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
            {deleteResumeBranch.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t("resume.history.deleteDialog.error")}
              </Alert>
            )}
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
            revertTarget ? revertTarget.title || t("resume.history.defaultMessage") : ""
          }
          isPending={revertCommit.isPending}
          error={revertError}
          onClose={() => { if (!revertCommit.isPending) setRevertTarget(null); }}
          onConfirm={handleConfirmRevert}
        />
      </PageContent>
    </>
  );
}

function HistoryIndexRoute() {
  return <VersionHistoryPage />;
}
