import type { ResumeBranchHistoryGraph } from "@cv-tool/contracts";

export type GraphBranch = ResumeBranchHistoryGraph["branches"][number];
export type GraphCommit = ResumeBranchHistoryGraph["commits"][number];
export type GraphEdge = ResumeBranchHistoryGraph["edges"][number];

export interface GraphLayoutBranch extends GraphBranch {
  isSynthetic?: boolean;
}

export interface GraphLayout {
  orderedBranches: GraphLayoutBranch[];
  orderedCommits: GraphCommit[];
  branchIndexById: Map<string, number>;
  commitIndexById: Map<string, number>;
  branchColorById: Map<string, string>;
  branchCommitsByBranchId: Map<string, GraphCommit[]>;
  commitsById: Map<string, GraphCommit>;
  branchIdByCommitId: Map<string, string>;
  branchById: Map<string, GraphLayoutBranch>;
  rootBranches: GraphLayoutBranch[];
  forkCommitIds: Set<string>;
  mergeEdges: GraphEdge[];
  labelColumnX: number;
  width: number;
  height: number;
}
