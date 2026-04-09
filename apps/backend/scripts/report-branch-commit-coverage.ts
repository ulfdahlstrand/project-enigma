import { getDb } from "../src/db/client.js";
import {
  loadCoverageInputs,
  printCoverageSummary,
} from "../src/db/branch-commit-utils.js";

async function main() {
  const db = getDb();

  try {
    const coverage = await loadCoverageInputs(db);

    printCoverageSummary({
      branches: coverage.reachableByBranch,
      totalCommitCount: coverage.allCommitIds.size,
      detachedCommitCount: coverage.detachedCommitIds.length,
    });
  } finally {
    await db.destroy();
  }
}

void main();
