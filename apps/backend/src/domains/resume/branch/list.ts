import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { listResumeBranchesInputSchema, listResumeBranchesOutputSchema } from "@cv-tool/contracts";

type ListResumeBranchesInput = z.infer<typeof listResumeBranchesInputSchema>;
type ListResumeBranchesOutput = z.infer<typeof listResumeBranchesOutputSchema>;

function collectReachableCommitIds(
  startCommitId: string | null,
  edges: Array<{ commitId: string; parentCommitId: string }>,
) {
  if (!startCommitId) {
    return new Set<string>();
  }

  const parentIdsByCommitId = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = parentIdsByCommitId.get(edge.commitId) ?? [];
    parentIdsByCommitId.set(edge.commitId, [...existing, edge.parentCommitId]);
  }

  const visited = new Set<string>();
  const stack = [startCommitId];

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

export async function listResumeBranches(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListResumeBranchesInput
): Promise<ListResumeBranchesOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify resume exists and check ownership
  const resume = await db
    .selectFrom("resumes")
    .select(["id", "employee_id"])
    .where("id", "=", input.resumeId)
    .executeTakeFirst();

  if (resume === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && resume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const rows = await db
    .selectFrom("resume_branches")
    .selectAll()
    .where("resume_id", "=", input.resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const edgeRows = await db
    .selectFrom("resume_commit_parents as rcp")
    .innerJoin("resume_commits as rc", "rc.id", "rcp.commit_id")
    .select(["rcp.commit_id as commitId", "rcp.parent_commit_id as parentCommitId"])
    .where("rc.resume_id", "=", input.resumeId)
    .execute();

  const mainBranch = rows.find((row) => row.is_main);
  const mainReachableCommitIds = collectReachableCommitIds(mainBranch?.head_commit_id ?? null, edgeRows);
  const visibleRows = rows.filter((row) => {
    if (row.is_main) {
      return true;
    }

    // Translation and revision branches are never hidden by the main-reachability
    // filter — they may intentionally share a HEAD commit with their source variant.
    if (row.branch_type === "translation" || row.branch_type === "revision") {
      return true;
    }

    if (!row.head_commit_id) {
      return true;
    }

    return !mainReachableCommitIds.has(row.head_commit_id);
  });

  // Build a map of branchId → headCommitId for staleness calculation.
  const headCommitIdByBranchId = new Map(rows.map((row) => [row.id, row.head_commit_id]));

  return visibleRows.map((row) => {
    const isStale =
      row.branch_type === "translation" &&
      row.source_branch_id !== null &&
      row.source_commit_id !== null &&
      row.source_commit_id !== (headCommitIdByBranchId.get(row.source_branch_id) ?? null);

    return {
      id: row.id,
      resumeId: row.resume_id,
      name: row.name,
      language: row.language,
      isMain: row.is_main,
      headCommitId: row.head_commit_id,
      forkedFromCommitId: row.forked_from_commit_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      branchType: row.branch_type,
      sourceBranchId: row.source_branch_id,
      sourceCommitId: row.source_commit_id,
      isStale,
    };
  });
}

export const listResumeBranchesHandler = implement(contract.listResumeBranches).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listResumeBranches(getDb(), user, input);
  }
);

export function createListResumeBranchesHandler(db: Kysely<Database>) {
  return implement(contract.listResumeBranches).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listResumeBranches(db, user, input);
    }
  );
}
