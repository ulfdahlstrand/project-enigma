import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "./types.js";

export type BranchRow = {
  id: string;
  resume_id: string;
  resume_title: string;
  name: string;
  is_main: boolean;
  head_commit_id: string | null;
  forked_from_commit_id: string | null;
};

export type CommitRow = {
  id: string;
  tree_id: string | null;
  created_at: Date;
};

export type ParentEdge = {
  commit_id: string;
  parent_commit_id: string;
};

export type TreeRevisionRefRow = {
  treeId: string;
  entryId: string;
  revisionId: string;
  revisionType: string;
};

export type CleanupPlan = {
  deletableCommits: Array<{
    id: string;
    treeId: string | null;
    createdAt: Date;
  }>;
  deletableTreeIds: string[];
  deletableRevisionIdsByType: Map<string, string[]>;
};

export function buildAdjacency(edges: ParentEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const children = adjacency.get(edge.commit_id) ?? [];
    adjacency.set(edge.commit_id, [...children, edge.parent_commit_id]);

    const parents = adjacency.get(edge.parent_commit_id) ?? [];
    adjacency.set(edge.parent_commit_id, [...parents, edge.commit_id]);
  }

  return adjacency;
}

export function collectBranchCommitIds(
  branch: BranchRow,
  parentIdsByCommitId: Map<string, string[]>,
): Set<string> {
  const rootCommitIds = [branch.head_commit_id, branch.forked_from_commit_id]
    .filter((value): value is string => Boolean(value));

  const visited = new Set<string>();
  const stack = [...rootCommitIds];

  while (stack.length > 0) {
    const commitId = stack.pop();
    if (!commitId || visited.has(commitId)) {
      continue;
    }

    visited.add(commitId);
    const parentIds = parentIdsByCommitId.get(commitId) ?? [];
    for (const parentId of parentIds) {
      if (!visited.has(parentId)) {
        stack.push(parentId);
      }
    }
  }

  return visited;
}

export function collectDetachedComponentCommitIds(
  targetCommitId: string,
  adjacency: Map<string, string[]>,
  protectedCommitIds: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [targetCommitId];

  while (stack.length > 0) {
    const commitId = stack.pop();
    if (!commitId || visited.has(commitId) || protectedCommitIds.has(commitId)) {
      continue;
    }

    visited.add(commitId);
    const connectedIds = adjacency.get(commitId) ?? [];
    for (const connectedId of connectedIds) {
      if (!visited.has(connectedId) && !protectedCommitIds.has(connectedId)) {
        stack.push(connectedId);
      }
    }
  }

  return visited;
}

export function collectDetachedLineageCommitIds(
  targetCommitId: string,
  parentIdsByCommitId: Map<string, string[]>,
  protectedCommitIds: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [targetCommitId];

  while (stack.length > 0) {
    const commitId = stack.pop();
    if (!commitId || visited.has(commitId) || protectedCommitIds.has(commitId)) {
      continue;
    }

    visited.add(commitId);
    const parentIds = parentIdsByCommitId.get(commitId) ?? [];
    for (const parentId of parentIds) {
      if (!visited.has(parentId) && !protectedCommitIds.has(parentId)) {
        stack.push(parentId);
      }
    }
  }

  return visited;
}

export function assertSafeIdentifier(identifier: string) {
  if (!/^[a-z_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
}

export function assertSafeUuid(uuid: string) {
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) {
    throw new Error(`Unsafe UUID value: ${uuid}`);
  }
}

export function buildUuidLiteralList(uuids: string[]) {
  return uuids
    .map((uuid) => {
      assertSafeUuid(uuid);
      return `'${uuid}'::uuid`;
    })
    .join(", ");
}

export async function loadCoverageInputs(db: Kysely<Database>) {
  const [branches, commitRows, parentEdges] = await Promise.all([
    db
      .selectFrom("resume_branches as rb")
      .innerJoin("resumes as r", "r.id", "rb.resume_id")
      .select([
        "rb.id as id",
        "rb.resume_id as resume_id",
        "r.title as resume_title",
        "rb.name as name",
        "rb.is_main as is_main",
        "rb.head_commit_id as head_commit_id",
        "rb.forked_from_commit_id as forked_from_commit_id",
      ])
      .orderBy("resume_id", "asc")
      .orderBy("rb.created_at", "asc")
      .execute() as Promise<BranchRow[]>,
    db
      .selectFrom("resume_commits")
      .select(["id", "tree_id", "created_at"])
      .orderBy("created_at", "asc")
      .execute() as Promise<CommitRow[]>,
    db
      .selectFrom("resume_commit_parents")
      .select(["commit_id", "parent_commit_id"])
      .execute() as Promise<ParentEdge[]>,
  ]);

  const parentIdsByCommitId = parentEdges.reduce<Map<string, string[]>>((acc, edge) => {
    const existing = acc.get(edge.commit_id) ?? [];
    acc.set(edge.commit_id, [...existing, edge.parent_commit_id]);
    return acc;
  }, new Map());

  const reachableByBranch = branches.map((branch) => {
    const reachableCommitIds = collectBranchCommitIds(branch, parentIdsByCommitId);
    return {
      ...branch,
      reachableCommitIds,
      reachableCommitCount: reachableCommitIds.size,
    };
  });

  const protectedCommitIds = reachableByBranch.reduce<Set<string>>((acc, branch) => {
    for (const commitId of branch.reachableCommitIds) {
      acc.add(commitId);
    }
    return acc;
  }, new Set<string>());

  const allCommitIds = new Set(commitRows.map((row) => row.id));
  const detachedCommitIds = [...allCommitIds].filter((commitId) => !protectedCommitIds.has(commitId));

  return {
    branches,
    commitRows,
    parentEdges,
    parentIdsByCommitId,
    reachableByBranch,
    protectedCommitIds,
    allCommitIds,
    detachedCommitIds,
  };
}

export async function loadTreeRevisionRefs(
  db: Kysely<Database>,
  treeIds: string[],
): Promise<TreeRevisionRefRow[]> {
  if (treeIds.length === 0) {
    return [];
  }

  return db
    .selectFrom("resume_tree_entries as rte")
    .innerJoin("resume_tree_entry_content as rtec", "rtec.entry_id", "rte.id")
    .select([
      "rte.tree_id as treeId",
      "rte.id as entryId",
      "rtec.revision_id as revisionId",
      "rtec.revision_type as revisionType",
    ])
    .where("rte.tree_id", "in", treeIds)
    .execute() as Promise<TreeRevisionRefRow[]>;
}

export function buildCleanupPlan(input: {
  commitIdsToDelete: string[];
  commitRows: CommitRow[];
  protectedTreeIds: Set<string>;
  deletableTreeRefs: TreeRevisionRefRow[];
  protectedTreeRefs: TreeRevisionRefRow[];
}): CleanupPlan {
  const commitById = new Map(input.commitRows.map((row) => [row.id, row]));
  const deletableCommits = input.commitIdsToDelete
    .map((commitId) => commitById.get(commitId))
    .filter((row): row is CommitRow => Boolean(row))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .map((row) => ({
      id: row.id,
      treeId: row.tree_id,
      createdAt: row.created_at,
    }));

  const deletableTreeIds = [...new Set(
    deletableCommits
      .map((commit) => commit.treeId)
      .filter((treeId): treeId is string => treeId !== null)
      .filter((treeId) => !input.protectedTreeIds.has(treeId))
  )];

  const protectedRevisionRefs = new Set(
    input.protectedTreeRefs.map((row) => `${row.revisionType}:${row.revisionId}`),
  );

  const deletableRevisionIdsByType = input.deletableTreeRefs.reduce<Map<string, string[]>>((acc, row) => {
    const key = `${row.revisionType}:${row.revisionId}`;
    if (!deletableTreeIds.includes(row.treeId) || protectedRevisionRefs.has(key)) {
      return acc;
    }

    const existing = acc.get(row.revisionType) ?? [];
    if (!existing.includes(row.revisionId)) {
      acc.set(row.revisionType, [...existing, row.revisionId]);
    }
    return acc;
  }, new Map());

  return {
    deletableCommits,
    deletableTreeIds,
    deletableRevisionIdsByType,
  };
}

export function printCoverageSummary(input: {
  branches: Array<BranchRow & { reachableCommitCount: number }>;
  totalCommitCount: number;
  detachedCommitCount: number;
}) {
  console.log("Branch commit coverage");
  console.log("======================");

  if (input.branches.length === 0) {
    console.log("No branches found.");
  } else {
    const branchesByResume = input.branches.reduce<Map<string, typeof input.branches>>((acc, branch) => {
      const existing = acc.get(branch.resume_id) ?? [];
      acc.set(branch.resume_id, [...existing, branch]);
      return acc;
    }, new Map());

    for (const [resumeId, resumeBranches] of branchesByResume.entries()) {
      const resumeTitle = resumeBranches[0]?.resume_title ?? resumeId;
      console.log(`${resumeTitle} (${resumeId})`);
      for (const branch of resumeBranches) {
        const branchKind = branch.is_main ? "main" : "branch";
        console.log(`- ${branch.name} (${branchKind}): ${branch.reachableCommitCount} commits`);
      }
      console.log("");
    }
  }

  console.log(`Total commits: ${input.totalCommitCount}`);
  console.log(`Detached commits: ${input.detachedCommitCount}`);
}

export function printCleanupPlan(plan: CleanupPlan) {
  console.log("");
  console.log("Cleanup plan");
  console.log("============");
  console.log(`Commits to delete: ${plan.deletableCommits.length}`);
  console.log(`Trees to delete: ${plan.deletableTreeIds.length}`);

  let totalRevisionCount = 0;
  for (const revisionIds of plan.deletableRevisionIdsByType.values()) {
    totalRevisionCount += revisionIds.length;
  }
  console.log(`Revision rows to delete: ${totalRevisionCount}`);

  if (plan.deletableCommits.length > 0) {
    console.log("");
    console.log("Commit ids:");
    for (const commit of plan.deletableCommits) {
      console.log(`- ${commit.id} (${commit.treeId ? "has tree" : "no tree"})`);
    }
  }

  if (plan.deletableTreeIds.length > 0) {
    console.log("");
    console.log("Tree ids:");
    for (const treeId of plan.deletableTreeIds) {
      console.log(`- ${treeId}`);
    }
  }

  if (plan.deletableRevisionIdsByType.size > 0) {
    console.log("");
    console.log("Revision rows by table:");
    for (const [revisionType, revisionIds] of plan.deletableRevisionIdsByType.entries()) {
      console.log(`- ${revisionType}: ${revisionIds.length}`);
    }
  }
}

export async function executeCleanupPlan(
  db: Kysely<Database>,
  plan: CleanupPlan,
) {
  const revisionDeleteOrder = [
    "resume_revision_skill",
    "resume_revision_skill_group",
  ];

  await db.transaction().execute(async (trx) => {
    if (plan.deletableCommits.length > 0) {
      await trx
        .deleteFrom("resume_commits")
        .where("id", "in", plan.deletableCommits.map((commit) => commit.id))
        .execute();
    }

    if (plan.deletableTreeIds.length > 0) {
      await trx
        .deleteFrom("resume_trees")
        .where("id", "in", plan.deletableTreeIds)
        .execute();
    }

    const orderedRevisionDeletes = [
      ...revisionDeleteOrder
        .map((revisionType) => [revisionType, plan.deletableRevisionIdsByType.get(revisionType) ?? []] as const),
      ...[...plan.deletableRevisionIdsByType.entries()]
        .filter(([revisionType]) => !revisionDeleteOrder.includes(revisionType)),
    ];

    for (const [revisionType, revisionIds] of orderedRevisionDeletes) {
      if (revisionIds.length === 0) {
        continue;
      }

      assertSafeIdentifier(revisionType);
      const uuidLiteralList = buildUuidLiteralList(revisionIds);
      await sql.raw(
        `DELETE FROM "${revisionType}" WHERE id IN (${uuidLiteralList})`,
      ).execute(trx);
    }
  });
}
