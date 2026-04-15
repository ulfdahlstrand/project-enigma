import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { diffLines, diffWordsWithSpace } from "diff";
import {
  useResumeBranchHistoryGraph,
  useResumeBranches,
} from "../../../../../hooks/versioning";
import { useCommitDiff } from "../../../../../hooks/useCommitDiff";
import type { DiffGroup, DiffGroupItem, DiffStatus } from "../../../../../utils/diff-utils";
import { countDiffContribution } from "../../../../../utils/diff-utils";
import { UnifiedTextDiff } from "../../../../../components/ai-assistant/DiffReviewDialog";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";

type CompareVersionsPageProps = {
  forcedRange?: string | null;
};

type BranchRef = {
  name: string;
  headCommitId: string | null;
};

type CommitRef = {
  id: string;
};

type CompareViewMode = "summary" | "split";

function statusColor(status: string): "success" | "error" | "warning" | "default" {
  if (status === "added") return "success";
  if (status === "removed") return "error";
  if (status === "modified") return "warning";
  return "default";
}

function statusBorderColor(status: DiffStatus): string {
  if (status === "added") return "success.main";
  if (status === "removed") return "error.main";
  if (status === "modified") return "warning.main";
  return "divider";
}

export function parseCompareRange(range?: string | null) {
  if (!range) {
    return { baseRef: "", compareRef: "" };
  }

  const separatorIndex = range.indexOf("...");

  if (separatorIndex === -1) {
    return { baseRef: "", compareRef: "" };
  }

  return {
    baseRef: range.slice(0, separatorIndex),
    compareRef: range.slice(separatorIndex + 3),
  };
}

export function resolveCompareRefToCommitId(
  ref: string,
  branchOptions: BranchRef[],
  commitOptions: CommitRef[]
): string {
  if (!ref) {
    return "";
  }

  const branchMatch = branchOptions.find((branch) => branch.name === ref);
  if (branchMatch?.headCommitId) {
    return branchMatch.headCommitId;
  }

  const commitMatch = commitOptions.find((commit) => commit.id === ref);
  return commitMatch?.id ?? "";
}

function compareByCreatedAtDesc(a: { createdAt: string | Date | null }, b: { createdAt: string | Date | null }) {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}

type SideBySideDiffRow = {
  left: string | null;
  right: string | null;
  kind: "unchanged" | "removed" | "added" | "modified";
};

function splitLinesPreserveContent(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

function buildSideBySideDiffRows(original: string, suggested: string): SideBySideDiffRow[] {
  const parts = diffLines(original, suggested);
  const rows: SideBySideDiffRow[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;

    if (!part.added && !part.removed) {
      const lines = splitLinesPreserveContent(part.value);
      rows.push(
        ...lines.map((line) => ({
          left: line,
          right: line,
          kind: "unchanged" as const,
        })),
      );
      continue;
    }

    const nextPart = parts[index + 1];

    if (part.removed && nextPart?.added) {
      const leftLines = splitLinesPreserveContent(part.value);
      const rightLines = splitLinesPreserveContent(nextPart.value);
      const rowCount = Math.max(leftLines.length, rightLines.length);

      for (let lineIndex = 0; lineIndex < rowCount; lineIndex += 1) {
        rows.push({
          left: leftLines[lineIndex] ?? null,
          right: rightLines[lineIndex] ?? null,
          kind: "modified",
        });
      }

      index += 1;
      continue;
    }

    if (part.removed) {
      const lines = splitLinesPreserveContent(part.value);
      rows.push(
        ...lines.map((line) => ({
          left: line,
          right: null,
          kind: "removed" as const,
        })),
      );
      continue;
    }

    const lines = splitLinesPreserveContent(part.value);
    rows.push(
      ...lines.map((line) => ({
        left: null,
        right: line,
        kind: "added" as const,
      })),
    );
  }

  return rows.length > 0 ? rows : [{ left: "", right: "", kind: "unchanged" }];
}

function SideBySideTextDiff({
  original,
  suggested,
}: {
  original: string;
  suggested: string;
}) {
  const rows = buildSideBySideDiffRows(original, suggested);

  function renderInlineLine(
    side: "left" | "right",
    left: string | null,
    right: string | null,
    kind: SideBySideDiffRow["kind"],
  ) {
    const value = side === "left" ? left : right;
    if (value === null) {
      return " ";
    }

    if (kind !== "modified" || left === null || right === null) {
      return value;
    }

    const parts = diffWordsWithSpace(left, right);

    return parts
      .filter((part) => {
        if (side === "left") return !part.added;
        return !part.removed;
      })
      .map((part, index) => {
        const isHighlighted = side === "left" ? part.removed : part.added;

        if (!isHighlighted) {
          return <span key={`${side}-${index}`}>{part.value}</span>;
        }

        return (
          <Box
            key={`${side}-${index}`}
            component="span"
            sx={{
              bgcolor: side === "left" ? "rgba(248, 81, 73, 0.38)" : "rgba(46, 160, 67, 0.38)",
              color: side === "left" ? "#ffdcd7" : "#aff5b4",
              borderRadius: 0.5,
              px: 0.25,
            }}
          >
            {part.value}
          </Box>
        );
      });
  }

  return (
    <Box
      sx={{
        mt: 1,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#0d1117",
      }}
    >
      {rows.map((row, index) => {
        const leftSx =
          row.kind === "removed" || row.kind === "modified"
            ? {
                bgcolor: "rgba(248, 81, 73, 0.16)",
                color: "#ffdcd7",
              }
            : { color: "#c9d1d9" };
        const rightSx =
          row.kind === "added" || row.kind === "modified"
            ? {
                bgcolor: "rgba(46, 160, 67, 0.16)",
                color: "#aff5b4",
              }
            : { color: "#c9d1d9" };

        return (
          <Box
            key={`${row.kind}-${index}`}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderTop: index === 0 ? "none" : "1px solid rgba(240, 246, 252, 0.08)",
            }}
          >
            <Box
              sx={{
                minHeight: 28,
                px: 1.5,
                py: 0.75,
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                borderRight: "1px solid rgba(240, 246, 252, 0.08)",
                ...leftSx,
              }}
            >
              {renderInlineLine("left", row.left, row.right, row.kind)}
            </Box>
            <Box
              sx={{
                minHeight: 28,
                px: 1.5,
                py: 0.75,
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                ...rightSx,
              }}
            >
              {renderInlineLine("right", row.left, row.right, row.kind)}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
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
    [graph?.commits]
  );

  const branchOptions = useMemo(
    () =>
      [...branches].sort((a, b) => {
        if (a.isMain !== b.isMain) {
          return a.isMain ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      }),
    [branches]
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

  function commitLabel(id: string): string {
    const commit = commitOptions.find((entry) => entry.id === id);
    if (!commit) return id;
    const date =
      typeof commit.createdAt === "string"
        ? new Date(commit.createdAt).toLocaleString()
        : commit.createdAt?.toLocaleString() ?? "";
    const title = commit.title;
    return title ? `${title} (${date})` : date;
  }

  function branchLabel(name: string): string {
    const branch = branchOptions.find((entry) => entry.name === name);
    if (!branch) return name;

    if (!branch.headCommitId) {
      return `${branch.name} (${t("resume.compare.emptyBranch")})`;
    }

    return `${branch.name} (${commitLabel(branch.headCommitId)})`;
  }

  async function navigateToRange(nextBaseRef: string, nextCompareRef: string) {
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
  }

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

  const handleViewModeChange = (_event: MouseEvent<HTMLElement>, nextValue: CompareViewMode | null) => {
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
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FormControl sx={{ minWidth: 320 }} size="small">
              <InputLabel>{t("resume.compare.fromLabel")}</InputLabel>
              <Select
                value={baseRef}
                label={t("resume.compare.fromLabel")}
                onChange={(e) => handleBaseChange(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t("resume.compare.selectPlaceholder")}</em>
                </MenuItem>
                <ListSubheader>{t("resume.compare.branchGroupLabel")}</ListSubheader>
                {branchOptions.map((branch) => (
                  <MenuItem
                    key={`branch-${branch.id}`}
                    value={branch.name}
                    disabled={!branch.headCommitId}
                  >
                    {branchLabel(branch.name)}
                  </MenuItem>
                ))}
                <ListSubheader>{t("resume.compare.commitGroupLabel")}</ListSubheader>
                {commitOptions.map((commit) => (
                  <MenuItem key={commit.id} value={commit.id}>
                    {commitLabel(commit.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton
              onClick={handleSwap}
              aria-label={t("resume.compare.swapButton")}
              size="small"
              sx={{ alignSelf: "center", mb: 0.5 }}
            >
              <SwapHorizIcon />
            </IconButton>

            <FormControl sx={{ minWidth: 320 }} size="small">
              <InputLabel>{t("resume.compare.toLabel")}</InputLabel>
              <Select
                value={compareRef}
                label={t("resume.compare.toLabel")}
                onChange={(e) => handleCompareChange(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t("resume.compare.selectPlaceholder")}</em>
                </MenuItem>
                <ListSubheader>{t("resume.compare.branchGroupLabel")}</ListSubheader>
                {branchOptions.map((branch) => (
                  <MenuItem
                    key={`branch-${branch.id}-compare`}
                    value={branch.name}
                    disabled={!branch.headCommitId}
                  >
                    {branchLabel(branch.name)}
                  </MenuItem>
                ))}
                <ListSubheader>{t("resume.compare.commitGroupLabel")}</ListSubheader>
                {commitOptions.map((commit) => (
                  <MenuItem key={`${commit.id}-compare`} value={commit.id}>
                    {commitLabel(commit.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            <Card variant="outlined">
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    alignItems: { xs: "flex-start", md: "center" },
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <Typography variant="h6">
                      {t("resume.compare.changedGroups", { count: diffGroups.length })}
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      +{totalPlusCount}
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      -{totalMinusCount}
                    </Typography>
                  </Box>
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    size="small"
                    onChange={handleViewModeChange}
                    aria-label={t("resume.compare.viewModeLabel")}
                  >
                    <ToggleButton value="summary" aria-label={t("resume.compare.summaryView")}>
                      {t("resume.compare.summaryView")}
                    </ToggleButton>
                    <ToggleButton value="split" aria-label={t("resume.compare.splitView")}>
                      {t("resume.compare.splitView")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Divider />
                {diffGroups.map((group, index) => (
                  <Accordion
                    key={group.key}
                    disableGutters
                    elevation={0}
                    defaultExpanded={index === 0}
                    sx={{
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                        <Typography fontWeight={500}>{group.label}</Typography>
                        <Typography color="success.main" fontWeight={600}>
                          +{group.plusCount}
                        </Typography>
                        <Typography color="error.main" fontWeight={600}>
                          -{group.minusCount}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Stack spacing={1.5}>
                        {group.items.map((item) => (
                          <Card
                            key={item.key}
                            variant="outlined"
                            sx={{ borderLeftWidth: 3, borderLeftColor: statusBorderColor(item.status) }}
                          >
                            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                                <Chip
                                  label={t(`resume.compare.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                                  color={statusColor(item.status)}
                                  size="small"
                                />
                                <Typography variant="body2" fontWeight={600}>
                                  {item.title}
                                </Typography>
                              </Box>
                              {viewMode === "summary" ? (
                                <UnifiedTextDiff original={item.before} suggested={item.after} />
                              ) : (
                                <SideBySideTextDiff original={item.before} suggested={item.after} />
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </Box>
        )}
      </PageContent>
    </>
  );
}
