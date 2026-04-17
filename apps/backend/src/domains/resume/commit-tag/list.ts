import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import { sql, type Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { listCommitTagsInputSchema, listCommitTagsOutputSchema } from "@cv-tool/contracts";

type ListCommitTagsInput = z.infer<typeof listCommitTagsInputSchema>;
type ListCommitTagsOutput = z.infer<typeof listCommitTagsOutputSchema>;

export async function listCommitTags(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListCommitTagsInput
): Promise<ListCommitTagsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resume = await db
    .selectFrom("resumes as r")
    .select(["r.employee_id"])
    .where("r.id", "=", input.resumeId)
    .executeTakeFirst();

  if (!resume) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && resume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  // If a branchId is given, filter tags to ones whose relevant commit
  // (source_commit_id when current resume is the source, target_commit_id when it's the target)
  // is reachable from that branch's HEAD via the commit-parent graph.
  let reachableCommitIds: Set<string> | null = null;
  if (input.branchId) {
    const branch = await db
      .selectFrom("resume_branches as rb")
      .select(["rb.head_commit_id"])
      .where("rb.id", "=", input.branchId)
      .where("rb.resume_id", "=", input.resumeId)
      .executeTakeFirst();

    if (branch?.head_commit_id) {
      const reachable = await sql<{ commit_id: string }>`
        WITH RECURSIVE reachable(commit_id) AS (
          SELECT ${branch.head_commit_id}::uuid
          UNION
          SELECT rcp.parent_commit_id
          FROM resume_commit_parents rcp
          INNER JOIN reachable r ON rcp.commit_id = r.commit_id
        )
        SELECT commit_id FROM reachable
      `.execute(db);
      reachableCommitIds = new Set(reachable.rows.map((r) => r.commit_id));
    } else {
      reachableCommitIds = new Set();
    }
  }

  const rows = await db
    .selectFrom("commit_tags as ct")
    .innerJoin("resumes as src_r", "src_r.id", "ct.source_resume_id")
    .innerJoin("resumes as tgt_r", "tgt_r.id", "ct.target_resume_id")
    .leftJoin("resume_branches as src_rb", (join) =>
      join.onRef("src_rb.resume_id", "=", "ct.source_resume_id").on("src_rb.is_main", "=", true)
    )
    .leftJoin("resume_branches as tgt_rb", (join) =>
      join.onRef("tgt_rb.resume_id", "=", "ct.target_resume_id").on("tgt_rb.is_main", "=", true)
    )
    .select([
      "ct.id",
      "ct.source_resume_id",
      "ct.target_resume_id",
      "ct.source_commit_id",
      "ct.target_commit_id",
      "ct.kind",
      "ct.created_at",
      "ct.created_by",
      "src_r.title as source_resume_title",
      "src_r.language as source_language",
      "src_rb.id as source_branch_id",
      "src_rb.name as source_branch_name",
      "tgt_r.title as target_resume_title",
      "tgt_r.language as target_language",
      "tgt_rb.id as target_branch_id",
      "tgt_rb.name as target_branch_name",
    ])
    .where((eb) =>
      eb.or([
        eb("ct.source_resume_id", "=", input.resumeId),
        eb("ct.target_resume_id", "=", input.resumeId),
      ])
    )
    .execute();

  const filtered = reachableCommitIds
    ? rows.filter((row) => {
        const currentSideCommit =
          row.source_resume_id === input.resumeId ? row.source_commit_id : row.target_commit_id;
        return reachableCommitIds!.has(currentSideCommit);
      })
    : rows;

  return filtered.map((row) => ({
    id: row.id,
    sourceCommitId: row.source_commit_id,
    targetCommitId: row.target_commit_id,
    kind: row.kind,
    createdAt: row.created_at,
    createdBy: row.created_by,
    source: {
      resumeId: row.source_resume_id,
      resumeTitle: row.source_resume_title,
      language: row.source_language,
      commitId: row.source_commit_id,
      branchId: row.source_branch_id ?? null,
      branchName: row.source_branch_name ?? null,
    },
    target: {
      resumeId: row.target_resume_id,
      resumeTitle: row.target_resume_title,
      language: row.target_language,
      commitId: row.target_commit_id,
      branchId: row.target_branch_id ?? null,
      branchName: row.target_branch_name ?? null,
    },
  }));
}

export const listCommitTagsHandler = implement(contract.listCommitTags).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listCommitTags(getDb(), user, input);
  }
);

export function createListCommitTagsHandler(db: Kysely<Database>) {
  return implement(contract.listCommitTags).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listCommitTags(db, user, input);
    }
  );
}
