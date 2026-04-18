import type { GraphEdge } from "./history-graph-types";

// Re-export types and layout computation so existing consumers keep working.
export type {
  GraphBranch,
  GraphCommit,
  GraphEdge,
  GraphLayout,
  GraphLayoutBranch,
} from "./history-graph-types";
export { computeGraphLayout } from "./history-graph-layout";

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

