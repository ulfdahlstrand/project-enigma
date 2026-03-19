/**
 * /resumes/$id/compare — Compare Versions page.
 *
 * Two dropdowns to pick commits; renders a ResumeDiff when both are selected.
 *
 * Data: useResumeCommits(branchId), useResumeCommitDiff(baseId, headId)
 * i18n: useTranslation("common") — no plain string literals as JSX children
 * Styling: MUI sx prop only
 */
import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { orpc } from "../../../../../orpc-client";
import { resumeCommitsKey, useResumeCommitDiff } from "../../../../../hooks/versioning";


export const Route = createFileRoute("/_authenticated/resumes/$id_/compare/")({
  component: CompareVersionsPage,
});

function statusColor(status: string): "success" | "error" | "warning" | "default" {
  if (status === "added") return "success";
  if (status === "removed") return "error";
  if (status === "modified") return "warning";
  return "default";
}

function CompareVersionsPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };

  const [baseCommitId, setBaseCommitId] = useState<string>("");
  const [headCommitId, setHeadCommitId] = useState<string>("");

  // Fetch resume to get main branch id
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

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Button
          variant="text"
          onClick={() => void navigate({ to: "/resumes/$id", params: { id: resumeId } })}
        >
          {t("resume.detail.backButton")}
        </Button>
        <Typography variant="h5" component="h1">
          {t("resume.compare.pageTitle")}
        </Typography>
      </Box>

      {commitsLoading ? (
        <CircularProgress aria-label={t("resume.compare.loading")} />
      ) : (
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 300 }} size="small">
            <InputLabel>{t("resume.compare.versionALabel")}</InputLabel>
            <Select
              value={baseCommitId}
              label={t("resume.compare.versionALabel")}
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

          <FormControl sx={{ minWidth: 300 }} size="small">
            <InputLabel>{t("resume.compare.versionBLabel")}</InputLabel>
            <Select
              value={headCommitId}
              label={t("resume.compare.versionBLabel")}
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

      {diffLoading && <CircularProgress aria-label={t("resume.compare.loading")} />}

      {diffError && (
        <Alert severity="error">{t("resume.compare.error")}</Alert>
      )}

      {diffResult && !diffResult.diff.hasChanges && (
        <Alert severity="info">{t("resume.compare.noChanges")}</Alert>
      )}

      {diffResult?.diff.hasChanges && (
        <Box>
          {/* Scalar changes */}
          {Object.keys(diffResult.diff.scalars).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t("resume.compare.scalarsHeading")}
              </Typography>
              {Object.entries(diffResult.diff.scalars).map(([field, change]) => {
                if (!change) return null;
                const before = Array.isArray(change.before)
                  ? change.before.join(", ")
                  : String(change.before ?? "");
                const after = Array.isArray(change.after)
                  ? change.after.join(", ")
                  : String(change.after ?? "");
                return (
                  <Box key={field} sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {field}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Box sx={{ color: "error.main" }}>
                        <Typography variant="caption">{t("resume.compare.before")}</Typography>
                        <Typography variant="body2">{before || "—"}</Typography>
                      </Box>
                      <Box sx={{ color: "success.main" }}>
                        <Typography variant="caption">{t("resume.compare.after")}</Typography>
                        <Typography variant="body2">{after || "—"}</Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              <Divider sx={{ my: 2 }} />
            </Box>
          )}

          {/* Skills diff */}
          {diffResult.diff.skills.some((s) => s.status !== "unchanged") && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t("resume.compare.skillsHeading")}
              </Typography>
              {diffResult.diff.skills
                .filter((s) => s.status !== "unchanged")
                .map((skill) => (
                  <Box key={skill.name} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Chip
                      label={t(`resume.compare.status${skill.status.charAt(0).toUpperCase()}${skill.status.slice(1)}`)}
                      color={statusColor(skill.status)}
                      size="small"
                    />
                    <Typography variant="body2">{skill.name}</Typography>
                  </Box>
                ))}
              <Divider sx={{ my: 2 }} />
            </Box>
          )}

          {/* Assignments diff */}
          {diffResult.diff.assignments.some((a) => a.status !== "unchanged") && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t("resume.compare.assignmentsHeading")}
              </Typography>
              {diffResult.diff.assignments
                .filter((a) => a.status !== "unchanged")
                .map((item) => {
                  const label =
                    item.after?.clientName ??
                    item.before?.clientName ??
                    item.assignmentId;
                  return (
                    <Box key={item.assignmentId} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Chip
                        label={t(`resume.compare.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                        color={statusColor(item.status)}
                        size="small"
                      />
                      <Typography variant="body2">{label}</Typography>
                    </Box>
                  );
                })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
