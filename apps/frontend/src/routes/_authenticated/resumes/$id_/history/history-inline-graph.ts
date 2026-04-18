/**
 * Utilities for computing per-row inline SVG data for the History commit table.
 *
 * Each commit row renders an SVG cell showing:
 *   - Vertical lane lines for all branches active at that row
 *   - L-shaped connector curves that START at the parent commit (horizontal
 *     stub) and EXIT the top of the row on the child lane (vertical). The
 *     child lane's vertical line in the rows above continues the connection
 *     until it meets the child commit.
 *   - A commit node (filled = save, outlined = merge)
 *   - An active-state ring when the row is selected
 */

import { computeGraphLayout } from "./history-graph-layout";
import type { GraphBranch, GraphCommit, GraphEdge } from "./history-graph-types";

// -----------------------------------------------------------------------------
// Design constants
// -----------------------------------------------------------------------------

export const LANE_COLORS: readonly string[] = [
  "oklch(72% 0.12 245)",
  "oklch(78% 0.08 70)",
  "oklch(74% 0.10 155)",
  "oklch(72% 0.12 310)",
];

export const LANE_GAP = 22;
export const LANE_LEFT = 18;
export const ROW_H = 48;
export const ROW_MID = 24;
export const CURVE_CORNER = 10;
export const SVG_MIN_WIDTH = 120;

export function laneColor(laneIndex: number): string {
  return LANE_COLORS[laneIndex % LANE_COLORS.length] ?? LANE_COLORS[0] ?? "oklch(72% 0.12 245)";
}

// -----------------------------------------------------------------------------
// Data model
// -----------------------------------------------------------------------------

export interface OutgoingCurve {
  /** Lane of the child commit (the curve exits the top of this row on that lane). */
  targetLaneIndex: number;
  /** Row index of the child commit — used for extending lane ranges. */
  targetRowIndex: number;
}

export interface InlineGraphRow {
  commit: GraphCommit;
  rowIndex: number;
  laneIndex: number;
  isMerge: boolean;
  /** Curves originating from THIS commit, going up to a child on another lane. */
  outgoingCurves: OutgoingCurve[];
}

export interface LaneRange {
  minRowIndex: number;
  maxRowIndex: number;
}

export interface InlineGraphData {
  rows: InlineGraphRow[];
  /** Per-lane list of non-overlapping row segments. laneSegments[laneIndex] = segments[]. */
  laneSegments: LaneRange[][];
  laneCount: number;
  svgWidth: number;
}

// -----------------------------------------------------------------------------
// Computation
// -----------------------------------------------------------------------------

export function computeInlineGraphData(
  branches: GraphBranch[],
  commits: GraphCommit[],
  edges: GraphEdge[],
): InlineGraphData {
  if (commits.length === 0) {
    return { rows: [], laneSegments: [], laneCount: 0, svgWidth: SVG_MIN_WIDTH };
  }

  // Reuse the proven canvas layout — same lane ordering + synthetic-branch handling.
  const layout = computeGraphLayout(branches, commits, edges, true);
  const {
    branchIdByCommitId,
    branchIndexById,
    branchCommitsByBranchId,
    mergeEdges,
    orderedBranches,
  } = layout;

  // Sort newest first — row 0 = most recent. Child rows < parent rows.
  const sorted = [...commits].sort((a, b) => {
    const aStr = typeof a.createdAt === "string" ? a.createdAt : a.createdAt.toISOString();
    const bStr = typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString();
    return bStr.localeCompare(aStr);
  });

  const rowIndexByCommitId = new Map(sorted.map((c, i) => [c.id, i]));

  const mergeCommitIdSet = new Set<string>(mergeEdges.map((e) => e.commitId));

  function laneOfCommit(commitId: string): number | null {
    const branchId = branchIdByCommitId.get(commitId);
    if (branchId == null) return null;
    return branchIndexById.get(branchId) ?? null;
  }

  // ── Build outgoing-curve map keyed by PARENT commit id ─────────────────
  const outgoingByCommitId = new Map<string, OutgoingCurve[]>();

  function addOutgoing(parentId: string, curve: OutgoingCurve) {
    const existing = outgoingByCommitId.get(parentId) ?? [];
    outgoingByCommitId.set(parentId, [...existing, curve]);
  }

  // 1. Fork curves — parent = branch.forkedFromCommitId, child = oldest commit on branch
  for (const branch of orderedBranches) {
    if (!branch.forkedFromCommitId) continue;
    const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
    if (branchCommits.length === 0) continue;
    const firstCommit = branchCommits[0];
    if (!firstCommit) continue;

    const forkLane = laneOfCommit(branch.forkedFromCommitId);
    const branchLane = branchIndexById.get(branch.id);
    if (forkLane == null || branchLane == null) continue;
    if (forkLane === branchLane) continue;

    const childRow = rowIndexByCommitId.get(firstCommit.id);
    if (childRow == null) continue;

    addOutgoing(branch.forkedFromCommitId, {
      targetLaneIndex: branchLane,
      targetRowIndex: childRow,
    });
  }

  // 2. Merge curves — parent = edge.parentCommitId (source branch), child = edge.commitId (merge commit)
  for (const edge of mergeEdges) {
    const childLane = laneOfCommit(edge.commitId);
    const parentLane = laneOfCommit(edge.parentCommitId);
    if (childLane == null || parentLane == null) continue;
    if (childLane === parentLane) continue;

    const childRow = rowIndexByCommitId.get(edge.commitId);
    if (childRow == null) continue;

    addOutgoing(edge.parentCommitId, {
      targetLaneIndex: childLane,
      targetRowIndex: childRow,
    });
  }

  // ── Build rows ──────────────────────────────────────────────────────────
  const rows: InlineGraphRow[] = sorted.map((commit, rowIndex) => {
    const lane = laneOfCommit(commit.id) ?? 0;
    const outgoingCurves = outgoingByCommitId.get(commit.id) ?? [];
    return {
      commit,
      rowIndex,
      laneIndex: lane,
      isMerge: mergeCommitIdSet.has(commit.id),
      outgoingCurves,
    };
  });

  // ── Compute per-branch lane segments ────────────────────────────────────
  //
  // The layout reuses columns for non-overlapping branches. To avoid drawing
  // spurious lane lines between unrelated branches that share a column, we
  // track one segment per branch rather than a single fused min/max per lane.
  //
  // Each branch segment spans from its HEAD commit (newest, smallest rowIndex)
  // down to its fork commit (or oldest commit for root branches). The extension
  // to the fork commit's row ensures the row just above the fork draws its
  // bottom-half, connecting seamlessly to the L-curve that exits at y=0 of
  // the fork row.
  const laneSegmentsMap = new Map<number, LaneRange[]>();

  function addLaneSegment(laneIndex: number, minRow: number, maxRow: number) {
    const segs = laneSegmentsMap.get(laneIndex) ?? [];
    segs.push({ minRowIndex: minRow, maxRowIndex: maxRow });
    laneSegmentsMap.set(laneIndex, segs);
  }

  for (const branch of orderedBranches) {
    const laneIdx = branchIndexById.get(branch.id);
    if (laneIdx == null) continue;

    const branchCommits = branchCommitsByBranchId.get(branch.id) ?? [];
    const commitRows = branchCommits
      .map((c) => rowIndexByCommitId.get(c.id))
      .filter((r): r is number => r != null);

    if (commitRows.length === 0) continue;

    let minRow = Math.min(...commitRows);
    let maxRow = Math.max(...commitRows);

    // Extend down to the fork commit's row so the L-curve connection is
    // visually continuous (the row above the fork needs drawBottom = true).
    if (branch.forkedFromCommitId) {
      const forkRow = rowIndexByCommitId.get(branch.forkedFromCommitId);
      if (forkRow != null) {
        maxRow = Math.max(maxRow, forkRow);
      }
    }

    addLaneSegment(laneIdx, minRow, maxRow);
  }

  // For merge edges the destination lane needs a segment from the merge commit
  // down to the source commit's row, so the L-curve connects visually. If the
  // destination branch's own segment already covers this range it will simply
  // overlap (rendered identically), otherwise this explicit segment fills the gap.
  for (const edge of mergeEdges) {
    const childLane = laneOfCommit(edge.commitId);
    const parentLane = laneOfCommit(edge.parentCommitId);
    if (childLane == null || parentLane == null || childLane === parentLane) continue;

    const childRow = rowIndexByCommitId.get(edge.commitId);
    const parentRow = rowIndexByCommitId.get(edge.parentCommitId);
    if (childRow == null || parentRow == null) continue;

    addLaneSegment(childLane, childRow, parentRow);
  }

  const maxLane = Math.max(0, ...Array.from(laneSegmentsMap.keys()));
  const laneCount = maxLane + 1;

  const laneSegments: LaneRange[][] = Array.from({ length: laneCount }, (_, i) => {
    return laneSegmentsMap.get(i) ?? [];
  });

  const svgWidth = Math.max(SVG_MIN_WIDTH, LANE_LEFT + laneCount * LANE_GAP + 12);

  return { rows, laneSegments, laneCount, svgWidth };
}
