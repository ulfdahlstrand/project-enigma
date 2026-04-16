import {
  TREE_BRANCH_COLORS_DARK,
  TREE_BRANCH_COLORS_LIGHT,
  TREE_BRANCH_GAP,
  TREE_COMMIT_GAP,
  TREE_HEADER_HEIGHT,
  TREE_NODE_OUTER_RADIUS,
  TREE_PADDING_Y,
  TREE_ROW_PADDING_LEFT,
} from "./history-graph-constants";
import type {
  GraphBranch,
  GraphCommit,
  GraphEdge,
  GraphLayout,
  GraphLayoutBranch,
} from "./history-graph-types";
import { sortByCreatedAt } from "./history-graph-utils";

function getFirstParentIdByCommitId(
  graphCommits: GraphCommit[],
  graphEdges: GraphEdge[],
): Map<string, string | null> {
  const firstParentIdByCommitId = new Map<string, string | null>(
    graphCommits.map((commit) => [commit.id, commit.parentCommitId ?? null]),
  );

  graphEdges
    .filter((edge) => edge.parentOrder === 0)
    .forEach((edge) => {
      firstParentIdByCommitId.set(edge.commitId, edge.parentCommitId);
    });

  return firstParentIdByCommitId;
}

function deriveBranchAssignments(
  branches: GraphBranch[],
  graphCommits: GraphCommit[],
  graphEdges: GraphEdge[],
): {
  orderedLayoutBranches: GraphLayoutBranch[];
  branchIdByCommitId: Map<string, string>;
  branchCommitsByBranchId: Map<string, GraphCommit[]>;
} {
  const sortedBranches = sortByCreatedAt(branches);
  const commitsById = new Map(graphCommits.map((commit) => [commit.id, commit]));
  const firstParentIdByCommitId = getFirstParentIdByCommitId(graphCommits, graphEdges);
  const branchIdByCommitId = new Map<string, string>();
  const mergeChildCommitIdsByParentCommitId = new Map<string, string[]>();

  graphEdges
    .filter((edge) => edge.parentOrder > 0)
    .forEach((edge) => {
      const existing = mergeChildCommitIdsByParentCommitId.get(edge.parentCommitId) ?? [];
      mergeChildCommitIdsByParentCommitId.set(edge.parentCommitId, [...existing, edge.commitId]);
    });

  const assignCommitChainToBranch = (
    branchId: string,
    headCommitId: string | null,
    stopCommitId: string | null,
  ) => {
    let currentCommitId = headCommitId;

    while (currentCommitId && currentCommitId !== stopCommitId && !branchIdByCommitId.has(currentCommitId)) {
      branchIdByCommitId.set(currentCommitId, branchId);
      currentCommitId = firstParentIdByCommitId.get(currentCommitId) ?? null;
    }
  };

  sortedBranches.forEach((branch) => {
    assignCommitChainToBranch(branch.id, branch.headCommitId, branch.forkedFromCommitId);
  });

  const unassignedCommits = graphCommits.filter((commit) => !branchIdByCommitId.has(commit.id));
  const childCommitIdsByFirstParentId = new Map<string, string[]>();
  firstParentIdByCommitId.forEach((parentCommitId, commitId) => {
    if (!parentCommitId) return;
    const existing = childCommitIdsByFirstParentId.get(parentCommitId) ?? [];
    childCommitIdsByFirstParentId.set(parentCommitId, [...existing, commitId]);
  });

  const syntheticBranches: GraphLayoutBranch[] = [];
  const syntheticHeadCommits = sortByCreatedAt(unassignedCommits).reverse().filter((commit) =>
    !(childCommitIdsByFirstParentId.get(commit.id) ?? []).some((childCommitId) => !branchIdByCommitId.has(childCommitId)),
  );

  syntheticHeadCommits.forEach((headCommit, index) => {
    const mergeChildBranchId = (mergeChildCommitIdsByParentCommitId.get(headCommit.id) ?? [])
      .map((childCommitId) => commitsById.get(childCommitId))
      .filter((commit): commit is GraphCommit => Boolean(commit))
      .sort((a, b) => {
        const aDate = typeof a.createdAt === "string" ? a.createdAt : a.createdAt.toISOString();
        const bDate = typeof b.createdAt === "string" ? b.createdAt : b.createdAt.toISOString();
        return bDate.localeCompare(aDate);
      })
      .map((commit) => branchIdByCommitId.get(commit.id) ?? null)
      .find((branchId): branchId is string => branchId !== null);

    if (mergeChildBranchId) {
      let currentCommitId: string | null = headCommit.id;

      while (currentCommitId && !branchIdByCommitId.has(currentCommitId)) {
        branchIdByCommitId.set(currentCommitId, mergeChildBranchId);
        currentCommitId = firstParentIdByCommitId.get(currentCommitId) ?? null;
      }

      return;
    }

    const syntheticBranchId = `synthetic-${headCommit.id}`;
    let currentCommitId: string | null = headCommit.id;
    let forkedFromCommitId: string | null = null;

    while (currentCommitId && !branchIdByCommitId.has(currentCommitId)) {
      branchIdByCommitId.set(currentCommitId, syntheticBranchId);
      const nextCommitId: string | null = firstParentIdByCommitId.get(currentCommitId) ?? null;
      if (nextCommitId && branchIdByCommitId.has(nextCommitId)) {
        forkedFromCommitId = nextCommitId;
        break;
      }
      currentCommitId = nextCommitId;
    }

    syntheticBranches.push({
      id: syntheticBranchId,
      resumeId: headCommit.resumeId,
      name: `Historical branch ${index + 1}`,
      language: "und",
      isMain: false,
      headCommitId: headCommit.id,
      forkedFromCommitId,
      createdBy: null,
      createdAt: headCommit.createdAt,
      branchType: "variant",
      sourceBranchId: null,
      sourceCommitId: null,
      isStale: false,
      isArchived: false,
      isSynthetic: true,
    });
  });

  const orderedLayoutBranches = [...sortedBranches, ...syntheticBranches];
  const branchCommitsByBranchId = new Map(
    orderedLayoutBranches.map((branch) => [
      branch.id,
      sortByCreatedAt(graphCommits.filter((commit) => branchIdByCommitId.get(commit.id) === branch.id)),
    ]),
  );

  return { orderedLayoutBranches, branchIdByCommitId, branchCommitsByBranchId };
}

export function computeGraphLayout(
  branches: GraphBranch[],
  graphCommits: GraphCommit[],
  graphEdges: GraphEdge[],
  isDark: boolean,
): GraphLayout {
  const treeBranchColors = isDark ? TREE_BRANCH_COLORS_DARK : TREE_BRANCH_COLORS_LIGHT;
  const commitsById = new Map(graphCommits.map((commit) => [commit.id, commit]));
  const { orderedLayoutBranches, branchIdByCommitId, branchCommitsByBranchId } = deriveBranchAssignments(
    branches,
    graphCommits,
    graphEdges,
  );
  const childBranchesByForkCommitId = new Map<string, GraphBranch[]>();
  orderedLayoutBranches.forEach((branch) => {
    if (!branch.forkedFromCommitId) return;
    const existing = childBranchesByForkCommitId.get(branch.forkedFromCommitId) ?? [];
    childBranchesByForkCommitId.set(branch.forkedFromCommitId, [...existing, branch]);
  });

  // Group all children by their PARENT BRANCH (not by exact fork commit) so that
  // siblings forked from different commits of the same parent are sorted together.
  const childBranchesByParentBranchId = new Map<string, GraphBranch[]>();
  orderedLayoutBranches.forEach((branch) => {
    if (!branch.forkedFromCommitId) return;
    const parentBranchId = branchIdByCommitId.get(branch.forkedFromCommitId);
    if (!parentBranchId) return;
    const existing = childBranchesByParentBranchId.get(parentBranchId) ?? [];
    childBranchesByParentBranchId.set(parentBranchId, [...existing, branch]);
  });
  const rootBranches = orderedLayoutBranches.filter(
    (branch) => !branch.forkedFromCommitId || !commitsById.has(branch.forkedFromCommitId),
  );

  // Merged branch IDs: branches whose head commit is a merge-source (parentOrder > 0).
  // Used to sort non-merged siblings before merged ones so they get lower column numbers.
  const mergedBranchIds = new Set<string>();
  for (const e of graphEdges) {
    if (e.parentOrder > 0) {
      const mergedBranchId = branchIdByCommitId.get(e.parentCommitId);
      if (mergedBranchId) {
        mergedBranchIds.add(mergedBranchId);
      }
    }
  }

  const orderedBranchIds: string[] = [];
  const visitedBranchIds = new Set<string>();

  function pushBranchAndChildren(branchId: string) {
    if (visitedBranchIds.has(branchId)) return;
    visitedBranchIds.add(branchId);
    orderedBranchIds.push(branchId);
    // Use parent-branch grouping so siblings forked from different commits of
    // the same parent are sorted together. Merged children come first so the
    // greedy column algorithm assigns them lower column numbers (closer to base).
    const allChildren = childBranchesByParentBranchId.get(branchId) ?? [];
    const sortedChildren = [...allChildren].sort((a, b) => {
      const aMerged = mergedBranchIds.has(a.id) ? 0 : 1; // merged=0, non-merged=1
      const bMerged = mergedBranchIds.has(b.id) ? 0 : 1;
      return aMerged - bMerged;
    });
    sortedChildren.forEach((childBranch) => pushBranchAndChildren(childBranch.id));
  }

  rootBranches.forEach((branch) => pushBranchAndChildren(branch.id));
  orderedLayoutBranches.forEach((branch) => pushBranchAndChildren(branch.id));

  const orderedBranches = orderedBranchIds
    .map((branchId) => orderedLayoutBranches.find((branch) => branch.id === branchId))
    .filter((branch): branch is GraphLayoutBranch => Boolean(branch));
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

    // Enforce: a child branch must be to the right of its parent branch.
    // Start the column search from parentCol + 1 so child is never placed at
    // the same column or to the left of the branch it was forked from.
    const parentBranchId = branch.forkedFromCommitId
      ? (branchIdByCommitId.get(branch.forkedFromCommitId) ?? null)
      : null;
    const parentCol = parentBranchId !== null ? (branchIndexById.get(parentBranchId) ?? null) : null;
    const minCol = parentCol !== null ? parentCol + 1 : 0;

    // Find the lowest column >= minCol where this branch's interval doesn't overlap any existing one
    let col = minCol;
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

  // Build branch row ranges for adjacency detection
  const branchRowRanges = new Map<string, [number, number]>();
  orderedBranches.forEach((branch) => {
    const range = getBranchRowRange(branch);
    if (range) branchRowRanges.set(branch.id, range);
  });

  // Two branches are color-adjacent if they are visually connected or side-by-side:
  //   (a) parent–child fork relationship, or
  //   (b) neighboring columns (|col diff| ≤ 1) with overlapping row ranges
  const colorAdjacency = new Map<string, Set<string>>();
  const addColorAdjacency = (a: string, b: string): void => {
    if (!colorAdjacency.has(a)) colorAdjacency.set(a, new Set());
    if (!colorAdjacency.has(b)) colorAdjacency.set(b, new Set());
    colorAdjacency.get(a)!.add(b);
    colorAdjacency.get(b)!.add(a);
  };

  orderedBranches.forEach((branch) => {
    if (!branch.forkedFromCommitId) return;
    const parentBranchId = branchIdByCommitId.get(branch.forkedFromCommitId);
    if (parentBranchId) addColorAdjacency(branch.id, parentBranchId);
  });

  orderedBranches.forEach((branchA, i) => {
    const colA = branchIndexById.get(branchA.id) ?? 0;
    const rangeA = branchRowRanges.get(branchA.id);
    if (!rangeA) return;
    for (let j = i + 1; j < orderedBranches.length; j++) {
      const branchB = orderedBranches[j]!;
      const colB = branchIndexById.get(branchB.id) ?? 0;
      if (Math.abs(colA - colB) > 1) continue;
      const rangeB = branchRowRanges.get(branchB.id);
      if (!rangeB) continue;
      const [topA, bottomA] = rangeA;
      const [topB, bottomB] = rangeB;
      if (topA <= bottomB && topB <= bottomA) addColorAdjacency(branchA.id, branchB.id);
    }
  });

  // Greedy graph coloring: assign each branch the smallest color index not
  // used by any of its color-adjacent (already-colored) neighbors.
  const branchColorIndexById = new Map<string, number>();
  orderedBranches.forEach((branch) => {
    const usedIndices = new Set<number>();
    for (const neighborId of colorAdjacency.get(branch.id) ?? []) {
      const neighborIndex = branchColorIndexById.get(neighborId);
      if (neighborIndex !== undefined) usedIndices.add(neighborIndex);
    }
    let colorIndex = 0;
    while (usedIndices.has(colorIndex)) colorIndex++;
    branchColorIndexById.set(branch.id, colorIndex);
  });

  const branchColorById = new Map(
    orderedBranches.map((branch) => {
      const colorIndex = branchColorIndexById.get(branch.id) ?? 0;
      return [branch.id, treeBranchColors[colorIndex % treeBranchColors.length]!];
    }),
  );

  const forkCommitIds = new Set(
    branches
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
    branchIdByCommitId,
    branchById: new Map(orderedBranches.map((branch) => [branch.id, branch])),
    rootBranches,
    forkCommitIds,
    mergeEdges,
    labelColumnX,
    width,
    height,
  };
}
