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
import { createFileRoute, redirect, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useResumeBranchHistoryGraph } from "../../../../../hooks/versioning";


export const Route = createFileRoute("/_authenticated/resumes/$id_/history/")({
  validateSearch: z.object({
    branchId: z.string().optional(),
    view: z.enum(["list", "tree"]).optional(),
  }),
  component: VersionHistoryPage,
});

function VersionHistoryPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: branchIdFromSearch, view: viewFromSearch } =
    useSearch({ strict: false }) as { branchId?: string; view?: "list" | "tree" };
  const {
    data: graph,
    isLoading,
    isError,
  } = useResumeBranchHistoryGraph(resumeId);

  const branches = graph?.branches ?? [];
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId =
    branches.find((branch) => branch.id === branchIdFromSearch)?.id ??
    mainBranchId;
  const selectedView = viewFromSearch ?? "list";
  const commits = (graph?.commits ?? []).filter((commit) => commit.branchId === selectedBranchId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress aria-label={t("resume.history.loading")} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{t("resume.history.error")}</Alert>
      </Box>
    );
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
          {t("resume.history.pageTitle")}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>{t("resume.history.branchLabel")}</InputLabel>
          <Select
            value={selectedBranchId}
            label={t("resume.history.branchLabel")}
            onChange={(event) =>
              void navigate({
                to: "/resumes/$id/history",
                params: { id: resumeId },
                search: { branchId: event.target.value, view: selectedView },
              })
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
              void navigate({
                to: "/resumes/$id/history",
                params: { id: resumeId },
                search: { branchId: selectedBranchId, view: "list" },
              })
            }
          >
            {t("resume.history.listView")}
          </Button>
          <Button
            variant={selectedView === "tree" ? "contained" : "outlined"}
            onClick={() =>
              void navigate({
                to: "/resumes/$id/history",
                params: { id: resumeId },
                search: { branchId: selectedBranchId, view: "tree" },
              })
            }
          >
            {t("resume.history.treeView")}
          </Button>
        </ButtonGroup>
      </Box>

      {selectedView === "tree" ? (
        !graph || graph.branches.length === 0 ? (
          <Typography variant="body1">{t("resume.history.empty")}</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {graph.branches.map((branch) => {
              const branchCommits = graph.commits.filter((commit) => commit.branchId === branch.id);
              const headCommit = graph.commits.find((commit) => commit.id === branch.headCommitId);
              const baseCommit = graph.commits.find((commit) => commit.id === branch.forkedFromCommitId);

              return (
                <Paper key={branch.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6">{branch.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("resume.history.treeHeadLabel")}: {headCommit?.message || headCommit?.id || "—"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("resume.history.treeBaseLabel")}: {baseCommit?.message || baseCommit?.id || t("resume.history.rootBranch")}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {t("resume.history.treeCommitCount", { count: branchCommits.length })}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        )
      ) : !commits || commits.length === 0 ? (
        <Typography variant="body1">{t("resume.history.empty")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label={t("resume.history.pageTitle")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("resume.history.tableHeaderMessage")}</TableCell>
                <TableCell>{t("resume.history.tableHeaderSavedAt")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commits.map((commit) => {
                const savedAt =
                  typeof commit.createdAt === "string"
                    ? new Date(commit.createdAt)
                    : commit.createdAt;
                const message = commit.message || t("resume.history.defaultMessage");

                return (
                  <TableRow key={commit.id}>
                    <TableCell>{message}</TableCell>
                    <TableCell>{savedAt.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
