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
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
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
import { useTheme } from "@mui/material/styles";
import { useResumeBranchHistoryGraph } from "../../../../../hooks/versioning";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { PageContent } from "../../../../../components/layout/PageContent";
import { LoadingState, ErrorState } from "../../../../../components/feedback";


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

const TREE_ROW_PADDING_LEFT = 6;    // left edge of hover row → first branch lane
const TREE_PADDING_Y = 10;
const TREE_HEADER_HEIGHT = 28;
const TREE_BRANCH_GAP = 16;
const TREE_COMMIT_GAP = 20;
const TREE_NODE_OUTER_RADIUS = 4;
const TREE_NODE_GAP_RADIUS = 2.4;
const TREE_NODE_INNER_RADIUS = 1.4;

const TREE_BRANCH_COLORS_DARK = ["#63a8ff", "#f59e0b", "#ff5cad", "#b47cff", "#4dd0c8", "#fb923c"];
const TREE_BRANCH_COLORS_LIGHT = ["#2563eb", "#d97706", "#db2777", "#7c3aed", "#0f766e", "#ea580c"];

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
  const graphCommits = graph?.commits ?? [];
  const isDark = theme.palette.mode === "dark";

  const graphLayout = useMemo(() => {
    const treeBranchColors = isDark ? TREE_BRANCH_COLORS_DARK : TREE_BRANCH_COLORS_LIGHT;
    const sortedBranches = sortByCreatedAt(branches);
    const commitsById = new Map(graphCommits.map((commit) => [commit.id, commit]));
    const branchCommitsByBranchId = new Map(
      sortedBranches.map((branch) => [
        branch.id,
        sortByCreatedAt(graphCommits.filter((commit) => commit.branchId === branch.id)),
      ])
    );
    const childBranchesByForkCommitId = new Map<string, typeof branches>();
    sortedBranches.forEach((branch) => {
      if (!branch.forkedFromCommitId) return;
      const existing = childBranchesByForkCommitId.get(branch.forkedFromCommitId) ?? [];
      childBranchesByForkCommitId.set(branch.forkedFromCommitId, [...existing, branch]);
    });
    const rootBranches = sortedBranches.filter(
      (branch) => !branch.forkedFromCommitId || !commitsById.has(branch.forkedFromCommitId)
    );

    const orderedBranchIds: string[] = [];
    const visitedBranchIds = new Set<string>();

    function pushBranchAndChildren(branchId: string) {
      if (visitedBranchIds.has(branchId)) return;
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
    const forkCommitIds = new Set(
      sortedBranches
        .map((b) => b.forkedFromCommitId)
        .filter((id): id is string => id !== null && id !== undefined)
    );

    const labelColumnX =
      TREE_ROW_PADDING_LEFT +
      Math.max(0, orderedBranches.length - 1) * TREE_BRANCH_GAP +
      TREE_NODE_OUTER_RADIUS * 2 + 8;
    const width = labelColumnX + 300;
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
      branchCommitsByBranchId,
      commitsById,
      rootBranches,
      forkCommitIds,
      labelColumnX,
      width,
      height,
    };
  }, [branches, graphCommits, isDark]);

  const selectedBranch =
    branches.find((branch) => branch.id === branchIdFromSearch) ??
    branches.find((branch) => branch.isMain) ??
    branches[0];
  const mainBranchId = branches.find((branch) => branch.isMain)?.id ?? "";
  const selectedBranchId = selectedBranch?.id ?? mainBranchId;
  const selectedView = viewFromSearch ?? "list";
  const commits = sortByCreatedAt(
    graphCommits.filter((commit) => commit.branchId === selectedBranchId)
  ).reverse();

  const graphSurfaceColor = isDark ? "#0d1117" : theme.palette.grey[50];
  const graphBorderColor = theme.palette.divider;

  function getBranchX(branchId: string) {
    return TREE_ROW_PADDING_LEFT + (graphLayout.branchIndexById.get(branchId) ?? 0) * TREE_BRANCH_GAP + TREE_NODE_OUTER_RADIUS;
  }

  function getCommitY(commitId: string) {
    return (
      TREE_HEADER_HEIGHT +
      TREE_PADDING_Y +
      (graphLayout.commitIndexById.get(commitId) ?? 0) * TREE_COMMIT_GAP +
      TREE_NODE_OUTER_RADIUS
    );
  }

  useEffect(() => {
    if (selectedView !== "tree") return;

    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { width, height, orderedBranches, orderedCommits, branchColorById, branchCommitsByBranchId, commitsById, forkCommitIds } = graphLayout;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = graphSurfaceColor;
    context.fillRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";

    function localBranchX(branchId: string) {
      return TREE_ROW_PADDING_LEFT + (graphLayout.branchIndexById.get(branchId) ?? 0) * TREE_BRANCH_GAP + TREE_NODE_OUTER_RADIUS;
    }
    function localCommitY(commitId: string) {
      return TREE_HEADER_HEIGHT + TREE_PADDING_Y + (graphLayout.commitIndexById.get(commitId) ?? 0) * TREE_COMMIT_GAP + TREE_NODE_OUTER_RADIUS;
    }

    // Draw branch lines and fork curves
    orderedBranches.forEach((branch) => {
      const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
      const bx = localBranchX(branch.id);
      const branchColor = branchColorById.get(branch.id) ?? "#61afef";
      const isSelected = branch.id === selectedBranchId;
      const lineColor = isSelected ? branchColor : `${branchColor}99`;
      const lineWidth = isSelected ? 2.5 : 1.5;

      if (branchCommits.length > 0) {
        const firstCommit = branchCommits[0];
        const lastCommit = branchCommits[branchCommits.length - 1];
        if (firstCommit && lastCommit) {
          context.strokeStyle = lineColor;
          context.lineWidth = lineWidth;
          context.beginPath();
          context.moveTo(bx, localCommitY(firstCommit.id));
          context.lineTo(bx, localCommitY(lastCommit.id));
          context.stroke();
        }
      }

      if (!branch.forkedFromCommitId) return;
      const baseCommit = commitsById.get(branch.forkedFromCommitId);
      if (!baseCommit?.branchId) return;

      const baseX = localBranchX(baseCommit.branchId);
      const baseY = localCommitY(baseCommit.id);
      const firstCommit = branchCommits[0];
      const targetX = bx;
      const targetY = firstCommit ? localCommitY(firstCommit.id) : baseY + TREE_COMMIT_GAP * 0.8;
      const turnRadius = Math.min(14, Math.abs(targetX - baseX) / 2, Math.abs(targetY - baseY) / 2);

      context.strokeStyle = lineColor;
      context.lineWidth = lineWidth;
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

    // Draw commit nodes — ⊙ for fork points, solid for all others
    orderedCommits.forEach((commit) => {
      const branch = branches.find((b) => b.id === commit.branchId);
      if (!branch) return;

      const branchColor = branchColorById.get(branch.id) ?? "#61afef";
      const isSelected = branch.id === selectedBranchId;
      const nodeColor = isSelected ? branchColor : `${branchColor}99`;
      const x = localBranchX(branch.id);
      const y = localCommitY(commit.id);

      if (forkCommitIds.has(commit.id)) {
        // Fork-point: ⊙ (outer ring → surface gap → inner dot)
        context.fillStyle = nodeColor;
        context.beginPath();
        context.arc(x, y, TREE_NODE_OUTER_RADIUS, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = graphSurfaceColor;
        context.beginPath();
        context.arc(x, y, TREE_NODE_GAP_RADIUS, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = nodeColor;
        context.beginPath();
        context.arc(x, y, TREE_NODE_INNER_RADIUS, 0, Math.PI * 2);
        context.fill();
      } else {
        // Regular commit: solid filled circle
        context.fillStyle = nodeColor;
        context.beginPath();
        context.arc(x, y, TREE_NODE_OUTER_RADIUS, 0, Math.PI * 2);
        context.fill();
      }
    });
  }, [
    selectedView,
    graphLayout,
    branches,
    selectedBranchId,
    graphSurfaceColor,
  ]);

  if (isLoading) return <LoadingState label={t("resume.history.loading")} />;
  if (isError) return <ErrorState message={t("resume.history.error")} />;

  return (
    <>
      <PageHeader
        title={t("resume.history.pageTitle")}
        breadcrumbs={[
          { label: t("resume.pageTitle"), to: "/resumes" },
          { label: t("resume.detail.pageTitle"), to: `/resumes/${resumeId}` },
        ]}
      />
      <PageContent>
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
        !graph || graphLayout.rootBranches.length === 0 ? (
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
                  pointerEvents: "none",
                }}
              />

              {/* Hoverable rows with commit labels and per-row tooltips — z-index 1 */}
              {graphLayout.orderedCommits.map((commit) => {
                const cy = getCommitY(commit.id);
                const commitLabel = commit.message || t("resume.history.defaultMessage");
                const branch = branches.find((b) => b.id === commit.branchId);
                const isHead = branch ? commit.id === branch.headCommitId : false;

                return (
                  <Tooltip
                    key={`row-${commit.id}`}
                    arrow
                    placement="right"
                    title={
                      <Box sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {commitLabel}
                        </Typography>
                        {branch ? (
                          <Typography variant="caption" sx={{ display: "block" }}>
                            {branch.name}
                          </Typography>
                        ) : null}
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
                        left: 0,
                        right: 0,
                        top: cy - TREE_COMMIT_GAP / 2,
                        height: TREE_COMMIT_GAP,
                        display: "flex",
                        alignItems: "center",
                        zIndex: 1,
                        borderRadius: 0.5,
                        cursor: "default",
                        "&:hover": {
                          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          position: "absolute",
                          left: graphLayout.labelColumnX,
                          right: 8,
                          color: "text.primary",
                          fontSize: "0.75rem",
                          lineHeight: 1,
                          pointerEvents: "none",
                        }}
                      >
                        {commitLabel}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}

              {/* Branch lane tooltip overlays — z-index 2 */}
              {graphLayout.orderedBranches.map((branch) => {
                const branchX = getBranchX(branch.id);
                const branchCommits = graphLayout.branchCommitsByBranchId.get(branch.id) ?? [];

                return (
                  <Tooltip
                    key={branch.id}
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
                        zIndex: 2,
                      }}
                    />
                  </Tooltip>
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
      </PageContent>
    </>
  );
}
