/**
 * backfill-commit-trees.ts
 *
 * One-time script that builds a tree structure for every legacy resume_commit
 * that has no tree_id (i.e. commits created before Phase 2 dual-write landed).
 *
 * Safe to run multiple times — only processes commits where tree_id IS NULL.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-commit-trees.ts
 *   npx tsx src/scripts/backfill-commit-trees.ts --batch-size 50 --dry-run
 *
 * Options:
 *   --batch-size <n>   Number of commits per batch (default: 100)
 *   --dry-run          Log what would be done without writing anything
 */

import { getDb } from "../db/client.js";
import { buildCommitTree } from "../domains/resume/lib/build-commit-tree.js";
import type { ResumeCommitContent } from "../db/types.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const batchSize = Number(args[args.indexOf("--batch-size") + 1] ?? 100) || 100;
const dryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfillCommitTrees(): Promise<void> {
  const db = getDb();

  // Count total work upfront so we can report progress
  const { count } = await db
    .selectFrom("resume_commits")
    .where("tree_id", "is", null)
    .select(db.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow();

  const total = Number(count);

  if (total === 0) {
    console.log("No legacy commits to backfill — all commits already have tree_id set.");
    return;
  }

  console.log(`Found ${total} legacy commit(s) to backfill (batch size: ${batchSize}${dryRun ? ", DRY RUN" : ""}).`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  while (true) {
    // Fetch one batch — re-query each iteration so already-updated rows are
    // excluded, making the loop naturally shrink until nothing is left.
    const batch = await db
      .selectFrom("resume_commits as rc")
      .innerJoin("resumes as r", "r.id", "rc.resume_id")
      .select(["rc.id", "rc.resume_id", "rc.content", "r.employee_id"])
      .where("rc.tree_id", "is", null)
      .orderBy("rc.created_at", "asc")
      .limit(batchSize)
      .execute();

    if (batch.length === 0) break;

    for (const row of batch) {
      const commitId = row.id;
      processed += 1;

      if (dryRun) {
        console.log(`[DRY RUN] Would backfill commit ${commitId} (resume: ${row.resume_id})`);
        succeeded += 1;
        continue;
      }

      try {
        const content = row.content as unknown as ResumeCommitContent;

        await db.transaction().execute(async (trx) => {
          const treeId = await buildCommitTree(
            trx,
            row.resume_id,
            row.employee_id,
            content,
            // Education is not included in legacy content snapshots.
            // Passing [] is consistent with how saveResumeVersion behaves today.
          );

          await trx
            .updateTable("resume_commits")
            .set({ tree_id: treeId })
            .where("id", "=", commitId)
            .where("tree_id", "is", null) // Guard: skip if already set by concurrent run
            .execute();
        });

        console.log(`[${processed}/${total}] ✓ ${commitId}`);
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${processed}/${total}] ✗ ${commitId}: ${message}`);
        failures.push({ id: commitId, error: message });
        failed += 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n──────────────────────────────────────");
  console.log(`Backfill complete.`);
  console.log(`  Total:     ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);

  if (failures.length > 0) {
    console.log("\nFailed commits:");
    for (const { id, error } of failures) {
      console.log(`  ${id}: ${error}`);
    }
    process.exit(1);
  }
}

backfillCommitTrees().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
