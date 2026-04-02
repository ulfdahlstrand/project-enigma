import type { ResumeBranchHistoryGraph } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GraphBranch = ResumeBranchHistoryGraph["branches"][number];
export type GraphCommit = ResumeBranchHistoryGraph["commits"][number];
export type GraphEdge = ResumeBranchHistoryGraph["edges"][number];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const TREE_ROW_PADDING_LEFT = 6;
export const TREE_PADDING_Y = 10;
export const TREE_HEADER_HEIGHT = 28;
export const TREE_BRANCH_GAP = 16;
export const TREE_COMMIT_GAP = 20;
export const TREE_NODE_OUTER_RADIUS = 4;
export const TREE_NODE_GAP_RADIUS = 2.4;
export const TREE_NODE_INNER_RADIUS = 1.4;

export const TREE_BRANCH_COLORS_DARK = ["#63a8ff", "#f59e0b", "#ff5cad", "#b47cff", "#4dd0c8", "#fb923c"];
export const TREE_BRANCH_COLORS_LIGHT = ["#2563eb", "#d97706", "#db2777", "#7c3aed", "#0f766e", "#ea580c"];

// ---------------------------------------------------------------------------
// Utility functions
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

// ---------------------------------------------------------------------------
// Graph layout computation
// ---------------------------------------------------------------------------

export interface GraphLayout {
  orderedBranches: GraphBranch[];
  orderedCommits: GraphCommit[];
  branchIndexById: Map<string, number>;
  commitIndexById: Map<string, number>;
  branchColorById: Map<string, string>;
  branchCommitsByBranchId: Map<string, GraphCommit[]>;
  commitsById: Map<string, GraphCommit>;
  rootBranches: GraphBranch[];
  forkCommitIds: Set<string>;
  mergeEdges: GraphEdge[];
  labelColumnX: number;
  width: number;
  height: number;
}

export function computeGraphLayout(
  branches: GraphBranch[],
  graphCommits: GraphCommit[],
  graphEdges: GraphEdge[],
  isDark: boolean,
): GraphLayout {
  const treeBranchColors = isDark ? TREE_BRANCH_COLORS_DARK : TREE_BRANCH_COLORS_LIGHT;
  const sortedBranches = sortByCreatedAt(branches);
  const commitsById = new Map(graphCommits.map((commit) => [commit.id, commit]));
  const branchCommitsByBranchId = new Map(
    sortedBranches.map((branch) => [
      branch.id,
      sortByCreatedAt(graphCommits.filter((commit) => commit.branchId === branch.id)),
    ]),
  );
  const childBranchesByForkCommitId = new Map<string, GraphBranch[]>();
  sortedBranches.forEach((branch) => {
    if (!branch.forkedFromCommitId) return;
    const existing = childBranchesByForkCommitId.get(branch.forkedFromCommitId) ?? [];
    childBranchesByForkCommitId.set(branch.forkedFromCommitId, [...existing, branch]);
  });
  const rootBranches = sortedBranches.filter(
    (branch) => !branch.forkedFromCommitId || !commitsById.has(branch.forkedFromCommitId),
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
    .filter((branch): branch is GraphBranch => Boolean(branch));
  const orderedCommits = sortByCreatedAt(graphCommits).reverse();
  const branchIndexById = new Map(orderedBranches.map((branch, index) => [branch.id, index]));
  const commitIndexById = new Map(orderedCommits.map((commit, index) => [commit.id, index]));
  const branchColorById = new Map(
    orderedBranches.map((branch, index) => [branch.id, treeBranchColors[index % treeBranchColors.length]!]),
  );
  const forkCommitIds = new Set(
    sortedBranches
      .map((b) => b.forkedFromCommitId)
      .filter((id): id is string => id !== null && id !== undefined),
  );
  const mergeEdges = graphEdges.filter((edge) => edge.parentOrder > 0);

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
    mergeEdges,
    labelColumnX,
    width,
    height,
  };
}

export function getBranchX(branchIndexById: Map<string, number>, branchId: string): number {
  return TREE_ROW_PADDING_LEFT + (branchIndexById.get(branchId) ?? 0) * TREE_BRANCH_GAP + TREE_NODE_OUTER_RADIUS;
}

export function getCommitY(commitIndexById: Map<string, number>, commitId: string): number {
  return (
    TREE_HEADER_HEIGHT +
    TREE_PADDING_Y +
    (commitIndexById.get(commitId) ?? 0) * TREE_COMMIT_GAP +
    TREE_NODE_OUTER_RADIUS
  );
}
