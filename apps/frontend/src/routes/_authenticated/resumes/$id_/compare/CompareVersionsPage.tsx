/**
 * CompareVersionsPage — top-level orchestrator for the two-commit compare
 * view. Selector + diff-groups card live in their own components; this
 * module wires up data fetching, URL navigation, and view-mode state.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import {
  useResumeBranchHistoryGraph,
  useResumeBranches,
} from "../../../../../hooks/versioning";
import { useCommitDiff } from "../../../../../hooks/useCommitDiff";
import { PageContent } from "../../../../../components/layout/PageContent";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { CompareDiffGroupsCard } from "./CompareDiffGroupsCard";
import { CompareRangeSelector } from "./CompareRangeSelector";
import {
  compareByCreatedAtDesc,
  parseCompareRange,
  resolveCompareRefToCommitId,
  type CompareViewMode,
} from "./compare-utils";

export { parseCompareRange, resolveCompareRefToCommitId } from "./compare-utils";

interface CompareVersionsPageProps {
  forcedRange?: string | null;
}

export function CompareVersionsPage({ forcedRange = null }: CompareVersionsPageProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const parsedRange = parseCompareRange(forcedRange);
  const [baseRef, setBaseRef] = useState(parsedRange.baseRef);
  const [compareRef, setCompareRef] = useState(parsedRange.compareRef);
  const [viewMode, setViewMode] = useState<CompareViewMode>("summary");

  useEffect(() => {
    setBaseRef(parsedRange.baseRef);
    setCompareRef(parsedRange.compareRef);
  }, [parsedRange.baseRef, parsedRange.compareRef]);

  const { data: branches = [], isLoading: branchesLoading } = useResumeBranches(resumeId);
  const { data: graph, isLoading: graphLoading } = useResumeBranchHistoryGraph(resumeId);

  const commitOptions = useMemo(
    () => [...(graph?.commits ?? [])].sort(compareByCreatedAtDesc),
    [graph?.commits],
  );

  const branchOptions = useMemo(
    () =>
      [...branches].sort((a, b) => {
        if (a.isMain !== b.isMain) {
          return a.isMain ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      }),
    [branches],
  );

  const baseCommitId = resolveCompareRefToCommitId(baseRef, branchOptions, commitOptions);
  const headCommitId = resolveCompareRefToCommitId(compareRef, branchOptions, commitOptions);

  const {
    diffGroups,
    plusCount: totalPlusCount,
    minusCount: totalMinusCount,
    hasChanges: diffHasChanges,
    isLoading: diffLoading,
    isError: diffError,
  } = useCommitDiff(baseCommitId || null, headCommitId || null);

  const commitLabel = (id: string): string => {
    const commit = commitOptions.find((entry) => entry.id === id);
    if (!commit) return id;
    const date =
      typeof commit.createdAt === "string"
        ? new Date(commit.createdAt).toLocaleString()
        : commit.createdAt?.toLocaleString() ?? "";
    const title = commit.title;
    return title ? `${title} (${date})` : date;
  };

  const branchLabel = (name: string): string => {
    const branch = branchOptions.find((entry) => entry.name === name);
    if (!branch) return name;

    if (!branch.headCommitId) {
      return `${branch.name} (${t("resume.compare.emptyBranch")})`;
    }

    return `${branch.name} (${commitLabel(branch.headCommitId)})`;
  };

  const navigateToRange = async (nextBaseRef: string, nextCompareRef: string) => {
    if (nextBaseRef && nextCompareRef) {
      await navigate({
        to: "/resumes/$id/compare/$range",
        params: { id: resumeId, range: `${nextBaseRef}...${nextCompareRef}` },
      });
      return;
    }

    await navigate({
      to: "/resumes/$id/compare",
      params: { id: resumeId },
    });
  };

  const handleSwap = () => {
    setBaseRef(compareRef);
    setCompareRef(baseRef);
    void navigateToRange(compareRef, baseRef);
  };

  const handleBaseChange = (nextBaseRef: string) => {
    setBaseRef(nextBaseRef);
    void navigateToRange(nextBaseRef, compareRef);
  };

  const handleCompareChange = (nextCompareRef: string) => {
    setCompareRef(nextCompareRef);
    void navigateToRange(baseRef, nextCompareRef);
  };

  const handleViewModeChange = (
    _event: MouseEvent<HTMLElement>,
    nextValue: CompareViewMode | null,
  ) => {
    if (nextValue) {
      setViewMode(nextValue);
    }
  };

  const loading = branchesLoading || graphLoading;
  const bothSelected = Boolean(baseCommitId && headCommitId);

  return (
    <>
      <PageHeader
        title={t("resume.compare.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <PageContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("resume.compare.description")}
        </Typography>

        {loading ? (
          <CircularProgress aria-label={t("resume.compare.loading")} />
        ) : (
          <CompareRangeSelector
            baseRef={baseRef}
            compareRef={compareRef}
            branchOptions={branchOptions}
            commitOptions={commitOptions}
            branchLabel={branchLabel}
            commitLabel={commitLabel}
            onBaseChange={handleBaseChange}
            onCompareChange={handleCompareChange}
            onSwap={handleSwap}
          />
        )}

        {!bothSelected && !loading && (
          <Typography variant="body2" color="text.disabled">
            {t("resume.compare.noSelectionHint")}
          </Typography>
        )}

        {diffLoading && <CircularProgress aria-label={t("resume.compare.loading")} />}

        {diffError && <Alert severity="error">{t("resume.compare.error")}</Alert>}

        {diffHasChanges === false && (
          <Alert severity="info">{t("resume.compare.noChanges")}</Alert>
        )}

        {diffHasChanges === true && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <CompareDiffGroupsCard
              diffGroups={diffGroups}
              totalPlusCount={totalPlusCount}
              totalMinusCount={totalMinusCount}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          </Box>
        )}
      </PageContent>
    </>
  );
}
