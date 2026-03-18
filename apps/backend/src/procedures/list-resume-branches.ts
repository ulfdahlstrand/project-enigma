import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { listResumeBranchesInputSchema, listResumeBranchesOutputSchema } from "@cv-tool/contracts";

type ListResumeBranchesInput = z.infer<typeof listResumeBranchesInputSchema>;
type ListResumeBranchesOutput = z.infer<typeof listResumeBranchesOutputSchema>;

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

  return rows.map((row) => ({
    id: row.id,
    resumeId: row.resume_id,
    name: row.name,
    language: row.language,
    isMain: row.is_main,
    headCommitId: row.head_commit_id,
    forkedFromCommitId: row.forked_from_commit_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
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
