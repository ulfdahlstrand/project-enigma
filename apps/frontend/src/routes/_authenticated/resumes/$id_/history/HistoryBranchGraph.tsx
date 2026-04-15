import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import type { GraphBranch, GraphCommit, GraphEdge } from "./history-graph-utils";
import {
  computeGraphLayout,
  formatCommitTimestamp,
  getBranchX,
  getCommitY,
  shouldRenderBranchLane,
  TREE_COMMIT_GAP,
  TREE_NODE_OUTER_RADIUS,
  TREE_NODE_GAP_RADIUS,
  TREE_NODE_INNER_RADIUS,
} from "./history-graph-utils";

interface HistoryBranchGraphProps {
  branches: GraphBranch[];
  graphCommits: GraphCommit[];
  graphEdges: GraphEdge[];
  selectedBranchId: string;
  onViewCommit: (commitId: string) => void;
}

export function HistoryBranchGraph({
  branches,
  graphCommits,
  graphEdges,
  selectedBranchId,
  onViewCommit,
}: HistoryBranchGraphProps) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDark = theme.palette.mode === "dark";

  const graphLayout = useMemo(
    () => computeGraphLayout(branches, graphCommits, graphEdges, isDark),
    [branches, graphCommits, graphEdges, isDark],
  );

  const graphSurfaceColor = isDark ? "#0d1117" : theme.palette.grey[50];
  const graphBorderColor = theme.palette.divider;

  useEffect(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const {
      width,
      height,
      orderedBranches,
      orderedCommits,
      branchColorById,
      branchCommitsByBranchId,
      commitsById,
      branchIdByCommitId,
      branchById,
      forkCommitIds,
      mergeEdges,
      branchIndexById,
      commitIndexById,
    } = graphLayout;

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

    const bx = (branchId: string) => getBranchX(branchIndexById, branchId);
    const cy = (commitId: string) => getCommitY(commitIndexById, commitId);

    // Draw branch lines and fork curves
    orderedBranches.forEach((branch) => {
      const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
      const branchX = bx(branch.id);
      const branchColor = branchColorById.get(branch.id) ?? "#61afef";
      const isSelected = branch.id === selectedBranchId;
      const lineColor = isSelected ? branchColor : `${branchColor}99`;
      const lineWidth = isSelected ? 2.5 : 1.5;
      const hasRenderedCommits = shouldRenderBranchLane(branchCommits);

      if (hasRenderedCommits) {
        const firstCommit = branchCommits[0];
        const lastCommit = branchCommits[branchCommits.length - 1];
        if (firstCommit && lastCommit) {
          context.strokeStyle = lineColor;
          context.lineWidth = lineWidth;
          context.beginPath();
          context.moveTo(branchX, cy(firstCommit.id));
          context.lineTo(branchX, cy(lastCommit.id));
          context.stroke();
        }
      }

      if (!hasRenderedCommits) return;
      if (!branch.forkedFromCommitId) return;
      const baseCommit = commitsById.get(branch.forkedFromCommitId);
      if (!baseCommit) return;
      const baseBranchId = baseCommit ? branchIdByCommitId.get(baseCommit.id) : null;
      if (!baseBranchId) return;

      const baseX = bx(baseBranchId);
      const baseY = cy(baseCommit.id);
      const firstCommit = branchCommits[0];
      const targetX = branchX;
      const targetY = firstCommit ? cy(firstCommit.id) : baseY + TREE_COMMIT_GAP * 0.8;
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

    mergeEdges.forEach((edge) => {
      const destinationCommit = commitsById.get(edge.commitId);
      const sourceCommit = commitsById.get(edge.parentCommitId);
      if (!destinationCommit || !sourceCommit) return;
      const destinationBranchId = destinationCommit ? branchIdByCommitId.get(destinationCommit.id) : null;
      const sourceBranchId = sourceCommit ? branchIdByCommitId.get(sourceCommit.id) : null;
      if (!destinationBranchId || !sourceBranchId) return;
      if (destinationBranchId === sourceBranchId) return;

      const destinationX = bx(destinationBranchId);
      const destinationY = cy(destinationCommit.id);
      const sourceX = bx(sourceBranchId);
      const sourceY = cy(sourceCommit.id);
      const sourceBranch = branchById.get(sourceBranchId);
      const branchColor = sourceBranch ? (branchColorById.get(sourceBranch.id) ?? "#61afef") : "#61afef";
      const isSelected = sourceBranchId === selectedBranchId;
      const lineColor = isSelected ? branchColor : `${branchColor}99`;
      const horizontalDirection = destinationX >= sourceX ? 1 : -1;
      const turnRadius = Math.min(
        14,
        Math.abs(destinationX - sourceX) / 2,
        Math.abs(destinationY - sourceY) / 2,
      );

      context.strokeStyle = lineColor;
      context.lineWidth = isSelected ? 2.5 : 1.5;
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.lineTo(sourceX, destinationY + turnRadius);
      context.quadraticCurveTo(sourceX, destinationY, sourceX + turnRadius * horizontalDirection, destinationY);
      context.lineTo(destinationX, destinationY);
      context.stroke();
    });

    // Draw commit nodes
    orderedCommits.forEach((commit) => {
      const commitBranchId = branchIdByCommitId.get(commit.id);
      const branch = commitBranchId ? branchById.get(commitBranchId) : null;
      if (!branch) return;

      const branchColor = branchColorById.get(branch.id) ?? "#61afef";
      const isSelected = branch.id === selectedBranchId;
      const nodeColor = isSelected ? branchColor : `${branchColor}99`;
      const x = bx(branch.id);
      const y = cy(commit.id);

      if (forkCommitIds.has(commit.id)) {
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
        context.fillStyle = nodeColor;
        context.beginPath();
        context.arc(x, y, TREE_NODE_OUTER_RADIUS, 0, Math.PI * 2);
        context.fill();
      }
    });
  }, [graphLayout, branches, selectedBranchId, graphSurfaceColor]);

  if (graphLayout.rootBranches.length === 0) {
    return <Typography variant="body1">{t("resume.history.empty")}</Typography>;
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, overflow: "auto", bgcolor: graphSurfaceColor, borderColor: graphBorderColor }}
    >
      <Box
        data-testid="history-graph"
        sx={{ position: "relative", width: graphLayout.width, height: graphLayout.height }}
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

        {graphLayout.orderedCommits.map((commit) => {
          const commitY = getCommitY(graphLayout.commitIndexById, commit.id);
          const commitLabel = commit.title || t("resume.history.defaultMessage");
          const commitBranchId = graphLayout.branchIdByCommitId.get(commit.id);
          const branch = commitBranchId ? graphLayout.branchById.get(commitBranchId) : null;
          const isHead = branch ? commit.id === branch.headCommitId : false;

          return (
            <Tooltip
              key={`row-${commit.id}`}
              arrow
              placement="right"
              title={
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{commitLabel}</Typography>
                  {commit.description && (
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, whiteSpace: "pre-wrap" }}>
                      {commit.description}
                    </Typography>
                  )}
                  {branch && !branch.isSynthetic && (
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>{branch.name}</Typography>
                  )}
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
                onClick={() => onViewCommit(commit.id)}
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: commitY - TREE_COMMIT_GAP / 2,
                  height: TREE_COMMIT_GAP,
                  display: "flex",
                  alignItems: "center",
                  zIndex: 1,
                  borderRadius: 0.5,
                  cursor: "pointer",
                  "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    left: graphLayout.labelColumnX,
                    width: "max-content",
                    maxWidth: "none",
                    color: "text.primary",
                    fontSize: "0.75rem",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {commitLabel}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}

        {graphLayout.orderedBranches.map((branch) => {
          const branchX = getBranchX(graphLayout.branchIndexById, branch.id);
          const branchCommits = graphLayout.branchCommitsByBranchId.get(branch.id) ?? [];

          return (
            <Tooltip
              key={branch.id}
              arrow
              title={
                <Box sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{branch.name}</Typography>
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
                  {branchCommits.length === 0 && (
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {t("resume.history.treeNoCommits")}
                    </Typography>
                  )}
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
  );
}
