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
  const commitIndexById = new Map(orderedCommits.map((commit, index) => [commit.id, index]));

  // ---------------------------------------------------------------------------
  // Column assignment — greedy interval reuse
  //
  // Each branch occupies a vertical range [topRow, bottomRow] where:
  //   topRow    = row index of the newest commit (small = top of graph)
  //   bottomRow = row index of the fork commit, or oldest commit for root branches
  //               (large = bottom of graph, since fork commits are older)
  //
  // Two branches can share the same column when their row ranges don't overlap.
  // We process branches in orderedBranches order and assign the lowest available
  // column, starting from 0. Branches in the same column get the same color.
  // ---------------------------------------------------------------------------

  const getBranchRowRange = (branch: GraphBranch): [number, number] | null => {
    const commits = branchCommitsByBranchId.get(branch.id) ?? [];
    const forkRow = branch.forkedFromCommitId != null
      ? (commitIndexById.get(branch.forkedFromCommitId) ?? null)
      : null;

    if (commits.length === 0 && forkRow == null) return null;

    const commitRows = commits.map((c) => commitIndexById.get(c.id) ?? 0);
    const topRow = commitRows.length > 0 ? Math.min(...commitRows) : (forkRow ?? 0);
    const maxCommitRow = commitRows.length > 0 ? Math.max(...commitRows) : (forkRow ?? 0);
    const bottomRow = forkRow != null ? Math.max(maxCommitRow, forkRow) : maxCommitRow;

    return [topRow, bottomRow];
  };

  // columnIntervals[col] = list of [topRow, bottomRow] already assigned to that column
  const columnIntervals: Array<Array<[number, number]>> = [];
  const branchIndexById = new Map<string, number>();

  orderedBranches.forEach((branch) => {
    const range = getBranchRowRange(branch);
    if (!range) {
      branchIndexById.set(branch.id, 0);
      return;
    }
    const [topRow, bottomRow] = range;

    // Find the lowest column where this branch's interval doesn't overlap any existing one
    let col = 0;
    while (true) {
      const intervals = columnIntervals[col] ?? [];
      const hasOverlap = intervals.some(([iTop, iBottom]) => topRow <= iBottom && iTop <= bottomRow);
      if (!hasOverlap) break;
      col++;
    }

    const colIntervals = columnIntervals[col] ?? [];
    columnIntervals[col] = colIntervals;
    colIntervals.push([topRow, bottomRow]);
    branchIndexById.set(branch.id, col);
  });

  // Branches that share a column get the same color — visually they form one "lane"
  const branchColorById = new Map(
    orderedBranches.map((branch) => {
      const col = branchIndexById.get(branch.id) ?? 0;
      return [branch.id, treeBranchColors[col % treeBranchColors.length]!];
    }),
  );

  const forkCommitIds = new Set(
    sortedBranches
      .map((b) => b.forkedFromCommitId)
      .filter((id): id is string => id !== null && id !== undefined),
  );
  const mergeEdges = graphEdges.filter((edge) => edge.parentOrder > 0);

  const maxColumn = Math.max(0, ...[...branchIndexById.values()]);
  const labelColumnX =
    TREE_ROW_PADDING_LEFT +
    maxColumn * TREE_BRANCH_GAP +
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
