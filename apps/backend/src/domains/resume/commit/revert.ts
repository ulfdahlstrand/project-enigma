import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readTreeContent } from "../lib/read-tree-content.js";
import { buildCommitTree } from "../lib/build-commit-tree.js";
import type { revertCommitInputSchema, revertCommitOutputSchema } from "@cv-tool/contracts";

type RevertCommitInput = z.infer<typeof revertCommitInputSchema>;
type RevertCommitOutput = z.infer<typeof revertCommitOutputSchema>;

/**
 * Walks parent edges to collect all commit IDs reachable from startId.
 * Used to verify the target commit is in this branch's history.
 */
async function collectReachableCommitIds(
  db: Kysely<Database>,
  resumeId: string,
  startId: string,
): Promise<Set<string>> {
  const parentRows = await db
    .selectFrom("resume_commit_parents as rcp")
    .select(["rcp.commit_id", "rcp.parent_commit_id"])
    .orderBy("rcp.commit_id", "asc")
    .execute();

  const parentMap = new Map<string, string[]>();
  for (const row of parentRows) {
    const existing = parentMap.get(row.commit_id) ?? [];
    parentMap.set(row.commit_id, [...existing, row.parent_commit_id]);
  }

  const reachable = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const parentId of parentMap.get(id) ?? []) {
      if (!reachable.has(parentId)) stack.push(parentId);
    }
  }

  return reachable;
}

// ---------------------------------------------------------------------------
// revertCommit — core logic
// ---------------------------------------------------------------------------

/**
 * Creates a new commit on the branch whose content is a snapshot of an older
 * commit, effectively restoring the CV to that earlier state without removing
 * any history. The target commit must be reachable from the branch's HEAD.
 *
 * Access rules:
 *   - Admins can revert any branch.
 *   - Consultants can only revert branches on their own resumes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - { branchId, targetCommitId, title?, description? }
 * @throws ORPCError("NOT_FOUND")  if the branch does not exist.
 * @throws ORPCError("BAD_REQUEST") if the branch has no commits, or the
 *                                  target commit is not reachable from HEAD.
 * @throws ORPCError("FORBIDDEN")  if a consultant does not own the resume.
 */
export async function revertCommit(
  db: Kysely<Database>,
  user: AuthUser,
  input: RevertCommitInput,
): Promise<RevertCommitOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.head_commit_id",
      "r.employee_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (branch.head_commit_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Branch has no commits — nothing to revert from",
    });
  }

  const reachable = await collectReachableCommitIds(db, branch.resume_id, branch.head_commit_id);

  if (!reachable.has(input.targetCommitId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Target commit is not reachable from this branch's HEAD",
    });
  }

  const targetCommitRow = await db
    .selectFrom("resume_commits")
    .select(["tree_id"])
    .where("id", "=", input.targetCommitId)
    .executeTakeFirst();

  if (targetCommitRow === undefined || !targetCommitRow.tree_id) {
    throw new ORPCError("BAD_REQUEST", { message: "Target commit has no content tree" });
  }

  const content = await readTreeContent(db, targetCommitRow.tree_id);

  const title = input.title?.trim() || "Revert to earlier version";
  const description = input.description?.trim() || "Reverted branch to an earlier commit snapshot.";

  const commit = await db.transaction().execute(async (trx) => {
    const treeId = await buildCommitTree(
      trx,
      branch.resume_id,
      branch.employee_id,
      content,
      targetCommitRow.tree_id,
    );

    const newCommit = await trx
      .insertInto("resume_commits")
      .values({
        resume_id: branch.resume_id,
        tree_id: treeId,
        title,
        description,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("resume_commit_parents")
      .values({
        commit_id: newCommit.id,
        parent_commit_id: branch.head_commit_id!,
        parent_order: 0,
      })
      .execute();

    await trx
      .updateTable("resume_branches")
      .set({ head_commit_id: newCommit.id })
      .where("id", "=", input.branchId)
      .execute();

    return newCommit;
  });

  return {
    id: commit.id,
    resumeId: commit.resume_id,
    parentCommitId: branch.head_commit_id,
    content,
    title: commit.title,
    description: commit.description,
    createdBy: commit.created_by,
    createdAt: commit.created_at,
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler
// ---------------------------------------------------------------------------

export const revertCommitHandler = implement(contract.revertCommit).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return revertCommit(getDb(), user, input);
  },
);

export function createRevertCommitHandler(db: Kysely<Database>) {
  return implement(contract.revertCommit).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return revertCommit(db, user, input);
    },
  );
}
