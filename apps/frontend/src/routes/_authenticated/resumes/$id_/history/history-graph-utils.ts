import {
  TREE_BRANCH_GAP,
  TREE_COMMIT_GAP,
  TREE_HEADER_HEIGHT,
  TREE_NODE_OUTER_RADIUS,
  TREE_PADDING_Y,
  TREE_ROW_PADDING_LEFT,
} from "./history-graph-constants";
import type { GraphCommit, GraphEdge } from "./history-graph-types";

// Re-export types, constants, and layout computation from their focused modules
// so existing consumers continue to import from this module.
export type {
  GraphBranch,
  GraphCommit,
  GraphEdge,
  GraphLayout,
  GraphLayoutBranch,
} from "./history-graph-types";
export {
  TREE_BRANCH_COLORS_DARK,
  TREE_BRANCH_COLORS_LIGHT,
  TREE_BRANCH_GAP,
  TREE_COMMIT_GAP,
  TREE_HEADER_HEIGHT,
  TREE_NODE_GAP_RADIUS,
  TREE_NODE_INNER_RADIUS,
  TREE_NODE_OUTER_RADIUS,
  TREE_PADDING_Y,
  TREE_ROW_PADDING_LEFT,
} from "./history-graph-constants";
export { computeGraphLayout } from "./history-graph-layout";

// ---------------------------------------------------------------------------
// Small utility functions
// ---------------------------------------------------------------------------

export function sortByCreatedAt<T extends { createdAt: string | Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDate = typeof a.createdAt === "string" ? a.createdAt : a.createdAt.toISOString();
    const bDate = typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString();
    return aDate.localeCompare(bDate);
  });
}

export function formatCommitTimestamp(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

export function getReachableCommitIds(
  headCommitId: string | null,
  graphEdges: GraphEdge[],
): Set<string> {
  if (!headCommitId) {
    return new Set();
  }

  const parentIdsByCommitId = new Map<string, string[]>();
  graphEdges.forEach((edge) => {
    const existing = parentIdsByCommitId.get(edge.commitId) ?? [];
    parentIdsByCommitId.set(edge.commitId, [...existing, edge.parentCommitId]);
  });

  const reachable = new Set<string>();
  const stack = [headCommitId];

  while (stack.length > 0) {
    const commitId = stack.pop()!;
    if (reachable.has(commitId)) {
      continue;
    }

    reachable.add(commitId);
    (parentIdsByCommitId.get(commitId) ?? []).forEach((parentCommitId) => {
      if (!reachable.has(parentCommitId)) {
        stack.push(parentCommitId);
      }
    });
  }

  return reachable;
}

export function getReachableCommits(
  headCommitId: string | null,
  graphCommits: GraphCommit[],
  graphEdges: GraphEdge[],
): GraphCommit[] {
  if (headCommitId && !graphCommits.some((commit) => commit.id === headCommitId)) {
    return [];
  }

  const reachableCommitIds = getReachableCommitIds(headCommitId, graphEdges);
  return graphCommits.filter((commit) => reachableCommitIds.has(commit.id));
}

export function shouldRenderBranchLane(branchCommits: GraphCommit[]): boolean {
  return branchCommits.length > 0;
}

export function getBranchX(branchIndexById: Map<string, number>, branchId: string): number {
  return (
    TREE_ROW_PADDING_LEFT +
    (branchIndexById.get(branchId) ?? 0) * TREE_BRANCH_GAP +
    TREE_NODE_OUTER_RADIUS
  );
}

export function getCommitY(commitIndexById: Map<string, number>, commitId: string): number {
  return (
    TREE_HEADER_HEIGHT +
    TREE_PADDING_Y +
    (commitIndexById.get(commitId) ?? 0) * TREE_COMMIT_GAP +
    TREE_NODE_OUTER_RADIUS
  );
}
