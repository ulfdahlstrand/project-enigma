/**
 * /resumes/$id/history — Version History page.
 *
 * Layout: HistoryFilterSidebar (left, 220px) + main area (event count + inline-graph table).
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
import Alert from "@mui/material/Alert";
import {
  useArchiveResumeBranch,
  useListCommitTags,
  useResumeBranchHistoryGraph,
  useRevertResumeCommit,
} from "../../../../../hooks/versioning";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";
import { RevertDialog } from "../../../../../components/RevertDialog";
import type { GraphCommit } from "./history-graph-utils";
import { ResumePageHeader } from "../../../../../components/resume-detail/ResumePageHeader";
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
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: branchIdFromSearch } =
    useSearch({ strict: false }) as { branchId?: string };
  const { data: graph, isLoading, isError } = useResumeBranchHistoryGraph(resumeId);
  const { data: commitTags } = useListCommitTags(resumeId);
  const revertCommit = useRevertResumeCommit();
  const { mutate: archiveBranch, isError: isArchiveError } = useArchiveResumeBranch();
  const [revertTarget, setRevertTarget] = useState<GraphCommit | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [activeFilters] = useState<Set<BranchFilterType>>(new Set());
  const [showArchived] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterState>({
    variantBranchId: null,
    commitType: "all",
  });

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

  const inlineGraphData = useMemo(
    () => computeInlineGraphData(filteredBranches, filteredGraph.commits, filteredGraph.edges),
    [filteredBranches, filteredGraph.commits, filteredGraph.edges],
  );

  const mergeCommitIds = useMemo(() => {
    const ids = new Set<string>();
    filteredGraph.edges.filter((e) => e.parentOrder > 0).forEach((e) => ids.add(e.commitId));
    return ids;
  }, [filteredGraph.edges]);

  const visibleRows = useMemo(() => {
    const allSorted = sortByCreatedAt(filteredGraph.commits).reverse();
    let filtered = allSorted;

    if (historyFilter.variantBranchId !== null) {
      const targetBranch = filteredBranches.find((b) => b.id === historyFilter.variantBranchId);
      if (targetBranch?.headCommitId) {
        const reachable = getReachableCommitIds(targetBranch.headCommitId, filteredGraph.edges);
        filtered = filtered.filter((c) => reachable.has(c.id));
      }
    }

    if (historyFilter.commitType === "merges") {
      filtered = filtered.filter((c) => mergeCommitIds.has(c.id));
    } else if (historyFilter.commitType === "changes") {
      filtered = filtered.filter((c) => !mergeCommitIds.has(c.id));
    }

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

  const commitCountByBranchId = useMemo(() => {
    const counts = new Map<string, number>();
    filteredBranches.forEach((branch) => {
      if (!branch.headCommitId) return;
      const reachable = getReachableCommitIds(branch.headCommitId, filteredGraph.edges);
      counts.set(branch.id, reachable.size);
    });
    return counts;
  }, [filteredBranches, filteredGraph.edges]);

  const selectedBranch =
    branches.find((b) => b.id === (historyFilter.variantBranchId ?? branchIdFromSearch)) ??
    branches.find((b) => b.isMain) ??
    branches[0];
  const selectedBranchId = selectedBranch?.id ?? "";

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

  function handleCompareWithParent(commitId: string, parentCommitId: string) {
    void navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
      search: { baseRef: parentCommitId, compareRef: commitId },
    });
  }

  if (isLoading) return <LoadingState label={t("resume.history.loading")} />;
  if (isError) return <ErrorState message={t("resume.history.error")} />;

  const totalCommitCount = filteredGraph.commits.length;
  const mergeCount = mergeCommitIds.size;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: ink[0] }}>
      <ResumePageHeader
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
      <Box
        sx={{
          flex: 1,
          color: fg[2],
          fontFamily: font.ui,
          fontSize: "14px",
          px: { xs: "20px", md: "32px" },
          py: { xs: "24px", md: "32px" },
        }}
      >
        {isArchiveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("resume.history.archiveError", { defaultValue: "Failed to update version. Please try again." })}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 0, alignItems: "flex-start", minHeight: 0 }}>
          <HistoryFilterSidebar
            branches={filteredBranches}
            commitCountByBranchId={commitCountByBranchId}
            totalCommitCount={totalCommitCount}
            mergeCommitCount={mergeCount}
            filterState={historyFilter}
            onFilterChange={setHistoryFilter}
          />

          <Box sx={{ flex: 1, minWidth: 0, paddingLeft: "24px", overflowX: "auto" }}>
            <Box
              sx={{
                fontFamily: font.ui,
                fontSize: "12px",
                color: fg[4],
                paddingBottom: "12px",
              }}
            >
              {t("resume.history.showingEvents", {
                defaultValue: "Visar {{count}} händelser",
                count: visibleRows.length,
              })}
            </Box>

            <Box
              sx={{
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
                onCompareWithParent={handleCompareWithParent}
                onRevert={handleRequestRevert}
              />
            </Box>
          </Box>
        </Box>

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
      </Box>
    </Box>
  );
}

function HistoryIndexRoute() {
  return <VersionHistoryPage />;
}
