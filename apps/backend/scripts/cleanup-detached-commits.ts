import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getDb } from "../src/db/client.js";
import {
  buildCleanupPlan,
  collectDetachedLineageCommitIds,
  executeCleanupPlan,
  loadCoverageInputs,
  loadTreeRevisionRefs,
  printCleanupPlan,
} from "../src/db/branch-commit-utils.js";

function parseArgs(argv: string[]) {
  const parsed: {
    commitId: string | null;
    noTrees: boolean;
  } = {
    commitId: null,
    noTrees: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--noTrees") {
      parsed.noTrees = true;
      continue;
    }

    if (arg === "--commit") {
      parsed.commitId = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

async function confirmCleanup() {
  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question("Are you sure you want to remove this data? [No/Yes] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

const args = parseArgs(process.argv.slice(2));

async function main() {
  const db = getDb();

  try {
    const coverage = await loadCoverageInputs(db);

    const { commitRows, parentIdsByCommitId, protectedCommitIds, detachedCommitIds, allCommitIds } = coverage;
    const commitRowById = new Map(commitRows.map((row) => [row.id, row]));

    const commitIdsToDelete = (() => {
      const candidateCommitIds = args.commitId
        ? (() => {
            if (!allCommitIds.has(args.commitId!)) {
              throw new Error(`Commit not found: ${args.commitId}`);
            }

            if (protectedCommitIds.has(args.commitId!)) {
              throw new Error(`Refusing cleanup for branch-reachable commit: ${args.commitId}`);
            }

            return [...collectDetachedLineageCommitIds(
              args.commitId!,
              parentIdsByCommitId,
              protectedCommitIds,
            )];
          })()
        : detachedCommitIds;

      if (!args.noTrees) {
        return candidateCommitIds;
      }

      return candidateCommitIds.filter((commitId) => {
        const commitRow = commitRowById.get(commitId);
        return commitRow?.tree_id === null;
      });
    })();

    const protectedTreeIds = new Set(
      commitRows
        .filter((row) => protectedCommitIds.has(row.id))
        .map((row) => row.tree_id)
        .filter((treeId): treeId is string => Boolean(treeId)),
    );

    const candidateTreeIds = [...new Set(
      commitRows
        .filter((row) => commitIdsToDelete.includes(row.id))
        .map((row) => row.tree_id)
        .filter((treeId): treeId is string => Boolean(treeId)),
    )];

    const [deletableTreeRefs, protectedTreeRefs] = await Promise.all([
      loadTreeRevisionRefs(db, candidateTreeIds),
      loadTreeRevisionRefs(db, [...protectedTreeIds]),
    ]);

    const plan = buildCleanupPlan({
      commitIdsToDelete,
      commitRows,
      protectedTreeIds,
      deletableTreeRefs,
      protectedTreeRefs,
    });

    printCleanupPlan(plan);

    if (
      plan.deletableCommits.length === 0 &&
      plan.deletableTreeIds.length === 0 &&
      plan.deletableRevisionIdsByType.size === 0
    ) {
      console.log("");
      console.log("Nothing to delete.");
      return;
    }

    const isConfirmed = await confirmCleanup();

    if (!isConfirmed) {
      console.log("");
      console.log("Cleanup cancelled.");
      return;
    }

    await executeCleanupPlan(db, plan);
    console.log("");
    console.log("Cleanup complete.");
  } finally {
    await db.destroy();
  }
}

void main();
