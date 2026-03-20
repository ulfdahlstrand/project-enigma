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
import Chip from "@mui/material/Chip";
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

function formatCommitLabel(message: string, fallback: string) {
  return message || fallback;
}

function sortByCreatedAt<T extends { createdAt: string | Date }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aDate = typeof a.createdAt === "string" ? a.createdAt : a.createdAt.toISOString();
    const bDate = typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString();
    return aDate.localeCompare(bDate);
  });
}

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
  const graphCommits = graph?.commits ?? [];
  const commits = graphCommits.filter((commit) => commit.branchId === selectedBranchId);
  const commitsById = new Map(graphCommits.map((commit) => [commit.id, commit]));
  const sortedBranches = sortByCreatedAt(branches);
  const branchCommitsByBranchId = new Map(
    sortedBranches.map((branch) => [
      branch.id,
      sortByCreatedAt(graphCommits.filter((commit) => commit.branchId === branch.id)),
    ])
  );
  const childBranchesByForkCommitId = new Map<string, typeof branches>();

  sortedBranches.forEach((branch) => {
    if (!branch.forkedFromCommitId) {
      return;
    }

    const existingBranches = childBranchesByForkCommitId.get(branch.forkedFromCommitId) ?? [];
    childBranchesByForkCommitId.set(branch.forkedFromCommitId, [...existingBranches, branch]);
  });

  const rootBranches = sortedBranches.filter(
    (branch) => !branch.forkedFromCommitId || !commitsById.has(branch.forkedFromCommitId)
  );

  function renderBranchTree(branchId: string, depth = 0): React.ReactNode {
    const branch = branches.find((item) => item.id === branchId);
    if (!branch) {
      return null;
    }

    const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
    const headCommit = branch.headCommitId ? commitsById.get(branch.headCommitId) : undefined;
    const baseCommit = branch.forkedFromCommitId ? commitsById.get(branch.forkedFromCommitId) : undefined;

    return (
      <Box
        key={branch.id}
        data-testid={`tree-branch-${branch.id}`}
        sx={{
          ml: depth === 0 ? 0 : 4,
          pl: depth === 0 ? 0 : 2.5,
          borderLeft: depth === 0 ? "none" : "2px solid",
          borderColor: "divider",
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderColor: branch.id === selectedBranchId ? "primary.main" : "divider",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Typography variant="h6">{branch.name}</Typography>
                {branch.isMain ? (
                  <Chip size="small" label={t("resume.history.mainBranchTag")} />
                ) : null}
                {branch.id === selectedBranchId ? (
                  <Chip size="small" color="primary" label={t("resume.history.currentBranchTag")} />
                ) : null}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {t("resume.history.treeBaseLabel")}:{" "}
                {baseCommit
                  ? formatCommitLabel(baseCommit.message, baseCommit.id)
                  : t("resume.history.rootBranch")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("resume.history.treeHeadLabel")}:{" "}
                {headCommit
                  ? formatCommitLabel(headCommit.message, headCommit.id)
                  : "—"}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ alignSelf: "flex-start" }}>
              {t("resume.history.treeCommitCount", { count: branchCommits.length })}
            </Typography>
          </Box>

          {branchCommits.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("resume.history.treeNoCommits")}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {branchCommits.map((commit) => {
                const isHead = commit.id === branch.headCommitId;
                const childBranches = childBranchesByForkCommitId.get(commit.id) ?? [];

                return (
                  <Box key={commit.id} sx={{ position: "relative", pl: 3 }}>
                    <Box
                      sx={{
                        position: "absolute",
                        left: 0,
                        top: 8,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: isHead ? "primary.main" : "background.paper",
                        border: "2px solid",
                        borderColor: isHead ? "primary.main" : "divider",
                      }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        left: 5,
                        top: 20,
                        bottom: childBranches.length > 0 ? -24 : -16,
                        width: 2,
                        bgcolor: "divider",
                        display: isHead && childBranches.length === 0 ? "none" : "block",
                      }}
                    />
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="body2" data-testid={`tree-commit-${commit.id}`}>
                        {formatCommitLabel(commit.message, commit.id)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isHead ? t("resume.history.treeHeadCommitTag") : t("resume.history.treeCommitTag")}
                      </Typography>
                    </Box>

                    {childBranches.length > 0 ? (
                      <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
                        {childBranches.map((childBranch) => renderBranchTree(childBranch.id, depth + 1))}
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>
    );
  }

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
        !graph || rootBranches.length === 0 ? (
          <Typography variant="body1">{t("resume.history.empty")}</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rootBranches.map((branch) => renderBranchTree(branch.id))}
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
