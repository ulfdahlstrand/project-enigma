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
import { useEffect, useMemo, useRef } from "react";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
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

function formatCommitTimestamp(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

const TREE_PADDING_X = 32;
const TREE_PADDING_Y = 24;
const TREE_HEADER_HEIGHT = 52;
const TREE_BRANCH_GAP = 38;
const TREE_COMMIT_GAP = 36;
const TREE_NODE_SIZE = 10;

function VersionHistoryPage() {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const navigate = useNavigate();
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { id: resumeId } = useParams({ strict: false }) as { id: string };
  const { branchId: branchIdFromSearch, view: viewFromSearch } =
    useSearch({ strict: false }) as { branchId?: string; view?: "list" | "tree" };
  const {
    data: graph,
    isLoading,
    isError,
  } = useResumeBranchHistoryGraph(resumeId);

  const branches = graph?.branches ?? [];
  const selectedBranch =
    branches.find((branch) => branch.id === branchIdFromSearch) ??
    branches.find((branch) => branch.isMain) ??
    branches[0];
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const selectedView = viewFromSearch ?? "list";
  const graphCommits = graph?.commits ?? [];
  const commits = sortByCreatedAt(
    graphCommits.filter((commit) => commit.branchId === selectedBranchId)
  ).reverse();
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
  const treeBranchColors = theme.palette.mode === "dark"
    ? ["#63a8ff", "#f59e0b", "#ff5cad", "#b47cff", "#4dd0c8", "#fb923c"]
    : ["#2563eb", "#d97706", "#db2777", "#7c3aed", "#0f766e", "#ea580c"];
  const graphLayout = useMemo(() => {
    const orderedBranchIds: string[] = [];
    const visitedBranchIds = new Set<string>();

    function pushBranchAndChildren(branchId: string) {
      if (visitedBranchIds.has(branchId)) {
        return;
      }

      visitedBranchIds.add(branchId);
      orderedBranchIds.push(branchId);

      const branchCommits = branchCommitsByBranchId.get(branchId) ?? [];
      branchCommits.forEach((commit) => {
        const childBranches = childBranchesByForkCommitId.get(commit.id) ?? [];
        childBranches.forEach((childBranch) => pushBranchAndChildren(childBranch.id));
      });
    }

    rootBranches.forEach((branch) => pushBranchAndChildren(branch.id));
    sortedBranches.forEach((branch) => pushBranchAndChildren(branch.id));

    const orderedBranches = orderedBranchIds
      .map((branchId) => branches.find((branch) => branch.id === branchId))
      .filter((branch): branch is NonNullable<typeof branch> => Boolean(branch));
    const orderedCommits = sortByCreatedAt(graphCommits).reverse();
    const branchIndexById = new Map(orderedBranches.map((branch, index) => [branch.id, index]));
    const commitIndexById = new Map(orderedCommits.map((commit, index) => [commit.id, index]));
    const branchColorById = new Map(
      orderedBranches.map((branch, index) => [branch.id, treeBranchColors[index % treeBranchColors.length]])
    );

    const width =
      TREE_PADDING_X * 2 +
      Math.max(1, orderedBranches.length - 1) * TREE_BRANCH_GAP +
      120;
    const height =
      TREE_HEADER_HEIGHT +
      TREE_PADDING_Y * 2 +
      Math.max(1, orderedCommits.length - 1) * TREE_COMMIT_GAP +
      60;

    return {
      orderedBranches,
      orderedCommits,
      branchIndexById,
      commitIndexById,
      branchColorById,
      width,
      height,
    };
  }, [branches, graphCommits, rootBranches, sortedBranches, branchCommitsByBranchId, childBranchesByForkCommitId, treeBranchColors]);

  function getBranchX(branchId: string) {
    return TREE_PADDING_X + (graphLayout.branchIndexById.get(branchId) ?? 0) * TREE_BRANCH_GAP + 48;
  }

  function getCommitY(commitId: string) {
    return (
      TREE_HEADER_HEIGHT +
      TREE_PADDING_Y +
      (graphLayout.commitIndexById.get(commitId) ?? 0) * TREE_COMMIT_GAP +
      18
    );
  }

  const graphSurfaceColor = theme.palette.mode === "dark" ? theme.palette.background.paper : theme.palette.grey[50];
  const graphBorderColor = theme.palette.divider;

  useEffect(() => {
    if (selectedView !== "tree") {
      return;
    }

    const canvas = graphCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = graphLayout.width * dpr;
    canvas.height = graphLayout.height * dpr;
    canvas.style.width = `${graphLayout.width}px`;
    canvas.style.height = `${graphLayout.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, graphLayout.width, graphLayout.height);

    context.fillStyle = graphSurfaceColor;
    context.fillRect(0, 0, graphLayout.width, graphLayout.height);

    context.lineCap = "round";
    context.lineJoin = "round";

    graphLayout.orderedBranches.forEach((branch) => {
      const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
      const branchX = getBranchX(branch.id);
      const branchColor = graphLayout.branchColorById.get(branch.id) ?? "#61afef";
      const lineColor = branch.id === selectedBranchId ? branchColor : `${branchColor}60`;

      if (branchCommits.length > 0) {
        const firstCommit = branchCommits[0];
        const lastCommit = branchCommits[branchCommits.length - 1];
        if (firstCommit && lastCommit) {
          context.strokeStyle = lineColor;
          context.lineWidth = branch.id === selectedBranchId ? 3 : 2;
          context.beginPath();
          context.moveTo(branchX, getCommitY(firstCommit.id));
          context.lineTo(branchX, getCommitY(lastCommit.id));
          context.stroke();
        }
      }

      if (!branch.forkedFromCommitId) {
        return;
      }

      const baseCommit = commitsById.get(branch.forkedFromCommitId);
      if (!baseCommit?.branchId) {
        return;
      }

      const baseX = getBranchX(baseCommit.branchId);
      const baseY = getCommitY(baseCommit.id);
      const firstCommit = branchCommits[0];
      const targetX = branchX;
      const targetY = firstCommit ? getCommitY(firstCommit.id) : baseY + TREE_COMMIT_GAP * 0.8;
      const turnRadius = Math.min(14, Math.abs(targetX - baseX) / 2, Math.abs(targetY - baseY) / 2);

      context.strokeStyle = lineColor;
      context.lineWidth = branch.id === selectedBranchId ? 3 : 2;
      context.beginPath();
      context.moveTo(baseX, baseY);
      context.lineTo(targetX - turnRadius, baseY);

      if (targetY >= baseY) {
        context.quadraticCurveTo(targetX, baseY, targetX, baseY + turnRadius);
      } else {
        context.quadraticCurveTo(targetX, baseY, targetX, baseY - turnRadius);
      }

      context.lineTo(targetX, targetY);
      context.stroke();
    });

    graphLayout.orderedCommits.forEach((commit) => {
      const branch = branches.find((item) => item.id === commit.branchId);
      if (!branch) {
        return;
      }

      const branchColor = graphLayout.branchColorById.get(branch.id) ?? "#61afef";
      const nodeColor = branch.id === selectedBranchId ? branchColor : `${branchColor}60`;
      const x = getBranchX(branch.id);
      const y = getCommitY(commit.id);

      context.fillStyle = nodeColor;
      context.beginPath();
      context.arc(x, y, TREE_NODE_SIZE / 2, 0, Math.PI * 2);
      context.fill();

      if (branch.id === selectedBranchId || commit.id === branch.headCommitId) {
        context.strokeStyle = theme.palette.mode === "dark" ? "#f8fafc" : theme.palette.common.white;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(x, y, TREE_NODE_SIZE / 2 + 2, 0, Math.PI * 2);
        context.stroke();
      }
    });
  }, [
    selectedView,
    graphLayout,
    branchCommitsByBranchId,
    branches,
    commitsById,
    selectedBranchId,
    graphSurfaceColor,
    theme.palette.mode,
    theme.palette.common.white,
  ]);

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
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              overflow: "auto",
              bgcolor: graphSurfaceColor,
              borderColor: graphBorderColor,
            }}
          >
            <Box
              data-testid="history-graph"
              sx={{
                position: "relative",
                width: graphLayout.width,
                height: graphLayout.height,
              }}
            >
              <Box
                component="canvas"
                ref={graphCanvasRef}
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: graphLayout.width,
                  height: graphLayout.height,
                  display: "block",
                }}
              />

              {graphLayout.orderedBranches.map((branch) => {
                const branchX = getBranchX(branch.id);
                const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];

                return (
                  <Box key={branch.id}>
                    <Tooltip
                      arrow
                      title={
                        <Box sx={{ py: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {branch.name}
                          </Typography>
                          <Typography variant="caption" sx={{ display: "block" }}>
                            {branch.isMain
                              ? t("resume.history.mainBranchTag")
                              : branch.id === selectedBranchId
                                ? t("resume.history.currentBranchTag")
                                : ""}
                          </Typography>
                          <Typography variant="caption" sx={{ display: "block" }}>
                            {t("resume.history.treeCommitCount", { count: branchCommits.length })}
                          </Typography>
                          {branchCommits.length === 0 ? (
                            <Typography variant="caption" sx={{ display: "block" }}>
                              {t("resume.history.treeNoCommits")}
                            </Typography>
                          ) : null}
                        </Box>
                      }
                    >
                      <Box
                        data-testid={`tree-branch-${branch.id}`}
                        aria-label={branch.name}
                        sx={{
                          position: "absolute",
                          left: branchX - 20,
                          top: 0,
                          width: 40,
                          height: graphLayout.height,
                          cursor: "default",
                        }}
                      />
                    </Tooltip>

                    {branchCommits.map((commit) => {
                      const isHead = commit.id === branch.headCommitId;
                      const commitLabel = formatCommitLabel(commit.message, commit.id);
                      const branchColor = graphLayout.branchColorById.get(branch.id) ?? "#61afef";

                      return (
                        <Tooltip
                          key={commit.id}
                          arrow
                          title={
                            <Box sx={{ py: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {commitLabel}
                              </Typography>
                              <Typography variant="caption" sx={{ display: "block" }}>
                                {branch.name}
                              </Typography>
                              <Typography variant="caption" sx={{ display: "block" }}>
                                {isHead ? t("resume.history.treeHeadCommitTag") : t("resume.history.treeCommitTag")}
                              </Typography>
                              <Typography variant="caption" sx={{ display: "block" }}>
                                {t("resume.history.tableHeaderSavedAt")}: {formatCommitTimestamp(commit.createdAt)}
                              </Typography>
                            </Box>
                          }
                        >
                          <Box
                            data-testid={`tree-commit-${commit.id}`}
                            aria-label={commitLabel}
                            sx={{
                              position: "absolute",
                              left: getBranchX(branch.id) - 12,
                              top: getCommitY(commit.id) - 12,
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              cursor: "default",
                              bgcolor: "transparent",
                              boxShadow:
                                branch.id === selectedBranchId
                                  ? `0 0 0 1px ${alpha(branchColor, 0.25)}`
                                  : "none",
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          </Paper>
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
