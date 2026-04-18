/**
 * CompareVersionsPage — top-level orchestrator for the two-commit compare
 * view. Selector + diff-groups card live in their own components; this
 * module wires up data fetching, URL navigation, and view-mode state.
 *
 * Styling: MUI sx prop only
 * i18n: useTranslation("common")
 */
import type { MouseEvent } from "react";
import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { accent, fg, font, ink, line } from "./compare-design";
import {
  useResumeBranchHistoryGraph,
  useResumeBranches,
} from "../../../../../hooks/versioning";
import { useCommitDiff } from "../../../../../hooks/useCommitDiff";
import { ResumePageHeader } from "../../../../../components/resume-detail/ResumePageHeader";
import { ResumeWorkbenchTabs } from "../../../../../components/resume-detail/ResumeWorkbenchTabs";
import { CompareDiffGroupsCard } from "./CompareDiffGroupsCard";
import { CompareRefPicker } from "./CompareRefPicker";
import { CompareSummaryStrip } from "./CompareSummaryStrip";
import {
  compareByCreatedAtDesc,
  resolveCompareRefToCommitId,
  type CompareViewMode,
} from "./compare-utils";

export { parseCompareRange, resolveCompareRefToCommitId } from "./compare-utils";

const TOTAL_DIFF_SECTIONS = 3;

export function CompareVersionsPage() {
  const { t } = useTranslation("common");
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

  const baseCommit = commitOptions.find((commit) => commit.id === baseCommitId);
  const headCommit = commitOptions.find((commit) => commit.id === headCommitId);
  const baseCreatedAt = baseCommit?.createdAt ? new Date(baseCommit.createdAt) : null;
  const headCreatedAt = headCommit?.createdAt ? new Date(headCommit.createdAt) : null;

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: ink[0] }}>
      <ResumePageHeader
        title={t("resume.compare.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <ResumeWorkbenchTabs
        resumeId={resumeId}
        activeBranchId={branchOptions.find((b) => b.name === compareRef)?.id ?? null}
        compareRef={compareRef || null}
      />
      <Box
        sx={{
          flex: 1,
          color: fg[2],
          fontFamily: font.ui,
          fontSize: "14px",
          lineHeight: 1.5,
          letterSpacing: "-0.005em",
          px: { xs: "20px", md: "32px" },
          py: { xs: "24px", md: "32px" },
        }}
      >
          <Box
            component="p"
            sx={{
              m: 0,
              mb: "24px",
              color: fg[3],
              fontSize: "13px",
              fontFamily: font.ui,
            }}
          >
            {t("resume.compare.description")}
          </Box>

          {loading ? (
            <CircularProgress aria-label={t("resume.compare.loading")} />
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" },
                gap: "14px",
                mb: "16px",
                alignItems: "center",
              }}
            >
              <CompareRefPicker
                label={t("resume.compare.fromLabel")}
                value={baseRef}
                branches={branchOptions}
                commits={commitOptions}
                onSelect={handleBaseChange}
                align="left"
              />
              <IconButton
                onClick={handleSwap}
                aria-label={t("resume.compare.swapButton")}
                sx={{
                  width: 36,
                  height: 36,
                  justifySelf: "center",
                  border: `1px solid ${accent.line}`,
                  color: accent.main,
                  backgroundColor: accent.soft,
                  "&:hover": {
                    backgroundColor: accent.soft,
                    borderColor: accent.main,
                  },
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
              <CompareRefPicker
                label={t("resume.compare.toLabel")}
                value={compareRef}
                branches={branchOptions}
                commits={commitOptions}
                onSelect={handleCompareChange}
                align="right"
              />
            </Box>
          )}

          {!bothSelected && !loading && (
            <Box
              component="p"
              sx={{
                m: 0,
                fontFamily: font.mono,
                fontSize: "12px",
                color: fg[5],
                letterSpacing: "0.02em",
              }}
            >
              {t("resume.compare.noSelectionHint")}
            </Box>
          )}

          {diffLoading && <CircularProgress aria-label={t("resume.compare.loading")} />}

          {diffError && <Alert severity="error">{t("resume.compare.error")}</Alert>}

          {diffHasChanges === false && (
            <Alert severity="info">{t("resume.compare.noChanges")}</Alert>
          )}

          {diffHasChanges === true && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <CompareSummaryStrip
                plusCount={totalPlusCount}
                minusCount={totalMinusCount}
                affectedSections={diffGroups.length}
                totalSections={TOTAL_DIFF_SECTIONS}
                baseCreatedAt={baseCreatedAt}
                headCreatedAt={headCreatedAt}
              />
              <CompareDiffGroupsCard
                diffGroups={diffGroups}
                totalPlusCount={totalPlusCount}
                totalMinusCount={totalMinusCount}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            </Box>
          )}
      </Box>
    </Box>
  );
}
