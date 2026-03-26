/**
 * /resumes/$id/compare — Compare Versions page.
 *
 * Two dropdowns to pick commits; renders a ResumeDiff when both are selected.
 *
 * Data: useResumeCommits(branchId), useResumeCommitDiff(baseId, headId)
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../../../orpc-client";
import { resumeCommitsKey, useResumeCommitDiff } from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";


export const Route = createFileRoute("/_authenticated/resumes/$id_/compare/")({
  component: CompareVersionsPage,
});

type DiffStatus = "added" | "removed" | "modified" | "unchanged";

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

function CompareVersionsPage() {
  const { t } = useTranslation("common");
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const [baseCommitId, setBaseCommitId] = useState<string>("");
  const [headCommitId, setHeadCommitId] = useState<string>("");

  const { data: resume } = useQuery({
    queryKey: ["getResume", resumeId],
    queryFn: () => orpc.getResume({ id: resumeId }),
    enabled: Boolean(resumeId),
  });

  const branchId = resume?.mainBranchId ?? "";

  const { data: commits, isLoading: commitsLoading } = useQuery({
    queryKey: resumeCommitsKey(branchId),
    queryFn: () => orpc.listResumeCommits({ branchId }),
    enabled: Boolean(branchId),
  });

  const {
    data: diffResult,
    isLoading: diffLoading,
    isError: diffError,
  } = useResumeCommitDiff(baseCommitId || null, headCommitId || null);

  const commitOptions = commits ?? [];

  function commitLabel(id: string): string {
    const c = commitOptions.find((x) => x.id === id);
    if (!c) return id;
    const date =
      typeof c.createdAt === "string"
        ? new Date(c.createdAt).toLocaleString()
        : c.createdAt.toLocaleString();
    return c.message ? `${c.message} (${date})` : date;
  }

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

        {commitsLoading ? (
          <CircularProgress aria-label={t("resume.compare.loading")} />
        ) : (
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FormControl sx={{ minWidth: 280 }} size="small">
              <InputLabel>{t("resume.compare.fromLabel")}</InputLabel>
              <Select
                value={baseCommitId}
                label={t("resume.compare.fromLabel")}
                onChange={(e) => setBaseCommitId(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t("resume.compare.selectPlaceholder")}</em>
                </MenuItem>
                {commitOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {commitLabel(c.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 280 }} size="small">
              <InputLabel>{t("resume.compare.toLabel")}</InputLabel>
              <Select
                value={headCommitId}
                label={t("resume.compare.toLabel")}
                onChange={(e) => setHeadCommitId(e.target.value)}
              >
                <MenuItem value="">
                  <em>{t("resume.compare.selectPlaceholder")}</em>
                </MenuItem>
                {commitOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {commitLabel(c.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {!bothSelected && !commitsLoading && (
          <Typography variant="body2" color="text.disabled">
            {t("resume.compare.noSelectionHint")}
          </Typography>
        )}

        {diffLoading && <CircularProgress aria-label={t("resume.compare.loading")} />}

        {diffError && (
          <Alert severity="error">{t("resume.compare.error")}</Alert>
        )}

        {diffResult && !diffResult.diff.hasChanges && (
          <Alert severity="info">{t("resume.compare.noChanges")}</Alert>
        )}

        {diffResult?.diff.hasChanges && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Scalar changes */}
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

            {/* Skills diff */}
            {diffResult.diff.skills.some((s) => s.status !== "unchanged") && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t("resume.compare.skillsHeading")}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {diffResult.diff.skills
                    .filter((s) => s.status !== "unchanged")
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

            {/* Assignments diff */}
            {diffResult.diff.assignments.some((a) => a.status !== "unchanged") && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t("resume.compare.assignmentsHeading")}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {diffResult.diff.assignments
                    .filter((a) => a.status !== "unchanged")
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
