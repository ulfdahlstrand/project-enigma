import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type {
  getResumeBranchHistoryGraphInputSchema,
  getResumeBranchHistoryGraphOutputSchema,
} from "@cv-tool/contracts";

type GetResumeBranchHistoryGraphInput = z.infer<typeof getResumeBranchHistoryGraphInputSchema>;
type GetResumeBranchHistoryGraphOutput = z.infer<typeof getResumeBranchHistoryGraphOutputSchema>;

export async function getResumeBranchHistoryGraph(
  db: Kysely<Database>,
  user: AuthUser,
  input: GetResumeBranchHistoryGraphInput
): Promise<GetResumeBranchHistoryGraphOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

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

  const branches = await db
    .selectFrom("resume_branches")
    .selectAll()
    .where("resume_id", "=", input.resumeId)
    .orderBy("created_at", "asc")
    .execute();

  const commits = await db
    .selectFrom("resume_commits")
    .select([
      "id",
      "resume_id",
      "branch_id",
      "parent_commit_id",
      "message",
      "created_by",
      "created_at",
    ])
    .where("resume_id", "=", input.resumeId)
    .orderBy("created_at", "asc")
    .execute();

  return {
    branches: branches.map((branch) => ({
      id: branch.id,
      resumeId: branch.resume_id,
      name: branch.name,
      language: branch.language,
      isMain: branch.is_main,
      headCommitId: branch.head_commit_id,
      forkedFromCommitId: branch.forked_from_commit_id,
      createdBy: branch.created_by,
      createdAt: branch.created_at,
    })),
    commits: commits.map((commit) => ({
      id: commit.id,
      resumeId: commit.resume_id,
      branchId: commit.branch_id,
      parentCommitId: commit.parent_commit_id,
      message: commit.message,
      createdBy: commit.created_by,
      createdAt: commit.created_at,
    })),
  };
}

export const getResumeBranchHistoryGraphHandler = implement(
  contract.getResumeBranchHistoryGraph
).handler(async ({ input, context }) => {
  const user = requireAuth(context as AuthContext);
  return getResumeBranchHistoryGraph(getDb(), user, input);
});

export function createGetResumeBranchHistoryGraphHandler(db: Kysely<Database>) {
  return implement(contract.getResumeBranchHistoryGraph).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResumeBranchHistoryGraph(db, user, input);
    }
  );
}
