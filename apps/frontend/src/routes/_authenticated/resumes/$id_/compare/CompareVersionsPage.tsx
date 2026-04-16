/**
 * CompareVersionsPage — top-level orchestrator for the two-commit compare
 * view. Selector + diff-groups card live in their own components; this
 * module wires up data fetching, URL navigation, and view-mode state.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import HistoryIcon from "@mui/icons-material/History";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  useResumeBranchHistoryGraph,
  useResumeBranches,
  useArchiveResumeBranch,
} from "../../../../../hooks/versioning";
import { useCommitDiff } from "../../../../../hooks/useCommitDiff";
import { PageContent } from "../../../../../components/layout/PageContent";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { CompareDiffGroupsCard } from "./CompareDiffGroupsCard";
import { BranchTreePicker } from "../../../../../components/BranchTreePicker";
import {
  compareByCreatedAtDesc,
  resolveCompareRefToCommitId,
  type CompareViewMode,
} from "./compare-utils";

export { parseCompareRange, resolveCompareRefToCommitId } from "./compare-utils";

export function CompareVersionsPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const [baseRef, setBaseRef] = useQueryState(
    "baseRef",
    parseAsString.withDefault(""),
  );
  const [compareRef, setCompareRef] = useQueryState(
    "compareRef",
    parseAsString.withDefault(""),
  );
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringEnum<CompareViewMode>(["summary", "split"]).withDefault("summary"),
  );

  const { data: branches = [], isLoading: branchesLoading } = useResumeBranches(resumeId);
  const { data: graph, isLoading: graphLoading } = useResumeBranchHistoryGraph(resumeId);
  const { mutate: archiveBranch } = useArchiveResumeBranch();

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

  const handleSwap = () => {
    void setBaseRef(compareRef);
    void setCompareRef(baseRef);
  };

  const handleBaseChange = (nextBaseRef: string) => {
    void setBaseRef(nextBaseRef);
  };

  const handleCompareChange = (nextCompareRef: string) => {
    void setCompareRef(nextCompareRef);
  };

  const handleArchiveBranch = (branchId: string, isArchived: boolean) => {
    archiveBranch({ branchId, isArchived, resumeId });
  };

  const handleViewModeChange = (
    _event: MouseEvent<HTMLElement>,
    nextValue: CompareViewMode | null,
  ) => {
    if (nextValue) {
      void setViewMode(nextValue);
    }
  };

  const loading = branchesLoading || graphLoading;
  const bothSelected = Boolean(baseCommitId && headCommitId);

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <>
      <PageHeader
        title={t("resume.compare.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
        actions={
          <>
            <IconButton
              size="small"
              aria-label={t("resume.compare.moreActions")}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  void navigate({ to: "/resumes/$id/history", params: { id: resumeId } });
                }}
              >
                <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
                {t("resume.compare.goToHistory")}
              </MenuItem>
            </Menu>
          </>
        }
      />
      <PageContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("resume.compare.description")}
        </Typography>

        {loading ? (
          <CircularProgress aria-label={t("resume.compare.loading")} />
        ) : (
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
            <BranchTreePicker
              label={t("resume.compare.fromLabel")}
              value={baseRef}
              branches={branches}
              allCommits={commitOptions}
              onSelect={handleBaseChange}
              onArchive={handleArchiveBranch}
            />
            <Box sx={{ display: "flex", alignItems: "flex-end", pb: 0.5 }}>
              <IconButton
                onClick={handleSwap}
                aria-label={t("resume.compare.swapButton")}
                size="small"
              >
                <SwapHorizIcon />
              </IconButton>
            </Box>
            <BranchTreePicker
              label={t("resume.compare.toLabel")}
              value={compareRef}
              branches={branches}
              allCommits={commitOptions}
              onSelect={handleCompareChange}
              onArchive={handleArchiveBranch}
            />
          </Box>
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
