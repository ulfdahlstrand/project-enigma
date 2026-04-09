import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import {
  useResumeBranchHistoryGraph,
  useResumeBranches,
  useResumeCommitDiff,
} from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";

type DiffStatus = "added" | "removed" | "modified" | "unchanged";

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

export function CompareVersionsPage({ forcedRange = null }: CompareVersionsPageProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const parsedRange = parseCompareRange(forcedRange);
  const [baseRef, setBaseRef] = useState(parsedRange.baseRef);
  const [compareRef, setCompareRef] = useState(parsedRange.compareRef);

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
    data: diffResult,
    isLoading: diffLoading,
    isError: diffError,
  } = useResumeCommitDiff(baseCommitId || null, headCommitId || null);

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

  const handleBaseChange = (nextBaseRef: string) => {
    setBaseRef(nextBaseRef);
    void navigateToRange(nextBaseRef, compareRef);
  };

  const handleCompareChange = (nextCompareRef: string) => {
    setCompareRef(nextCompareRef);
    void navigateToRange(baseRef, nextCompareRef);
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

        {diffResult && !diffResult.diff.hasChanges && (
          <Alert severity="info">{t("resume.compare.noChanges")}</Alert>
        )}

        {diffResult?.diff.hasChanges && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {Object.keys(diffResult.diff.scalars).length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t("resume.compare.scalarsHeading")}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {Object.entries(diffResult.diff.scalars).map(([field, change]) => {
                    if (!change) return null;
                    const before = Array.isArray(change.before)
                      ? change.before.join("\n\n")
                      : String(change.before ?? "");
                    const after = Array.isArray(change.after)
                      ? change.after.join("\n\n")
                      : String(change.after ?? "");
                    return (
                      <Card
                        key={field}
                        variant="outlined"
                        sx={{ borderLeftWidth: 3, borderLeftColor: "warning.main" }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {t("resume.compare.fieldLabel")}: <strong>{field}</strong>
                          </Typography>
                          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            <Box sx={{ flex: 1, minWidth: 180 }}>
                              <Typography variant="caption" color="error.main" fontWeight={600}>
                                {t("resume.compare.before")}
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                                {before || "—"}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 180 }}>
                              <Typography variant="caption" color="success.main" fontWeight={600}>
                                {t("resume.compare.after")}
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                                {after || "—"}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            )}

            {diffResult.diff.skills.some((skill) => skill.status !== "unchanged") && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t("resume.compare.skillsHeading")}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {diffResult.diff.skills
                    .filter((skill) => skill.status !== "unchanged")
                    .map((skill) => (
                      <Card
                        key={skill.name}
                        variant="outlined"
                        sx={{ borderLeftWidth: 3, borderLeftColor: statusBorderColor(skill.status as DiffStatus) }}
                      >
                        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={t(`resume.compare.status${skill.status.charAt(0).toUpperCase()}${skill.status.slice(1)}`)}
                            color={statusColor(skill.status)}
                            size="small"
                          />
                          <Typography variant="body2">{skill.name}</Typography>
                        </CardContent>
                      </Card>
                    ))}
                </Box>
              </Box>
            )}

            {diffResult.diff.assignments.some((assignment) => assignment.status !== "unchanged") && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t("resume.compare.assignmentsHeading")}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {diffResult.diff.assignments
                    .filter((assignment) => assignment.status !== "unchanged")
                    .map((item) => {
                      const label =
                        item.after?.clientName ??
                        item.before?.clientName ??
                        item.assignmentId;

                      return (
                        <Card
                          key={item.assignmentId}
                          variant="outlined"
                          sx={{ borderLeftWidth: 3, borderLeftColor: statusBorderColor(item.status as DiffStatus) }}
                        >
                          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Chip
                              label={t(`resume.compare.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                              color={statusColor(item.status)}
                              size="small"
                            />
                            <Typography variant="body2">{label}</Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </PageContent>
    </>
  );
}
