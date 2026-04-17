import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { deleteCommitTagInputSchema, deleteCommitTagOutputSchema } from "@cv-tool/contracts";

type DeleteCommitTagInput = z.infer<typeof deleteCommitTagInputSchema>;
type DeleteCommitTagOutput = z.infer<typeof deleteCommitTagOutputSchema>;

export async function deleteCommitTag(
  db: Kysely<Database>,
  user: AuthUser,
  input: DeleteCommitTagInput
): Promise<DeleteCommitTagOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const tag = await db
    .selectFrom("commit_tags as ct")
    .innerJoin("resume_commits as rc", "rc.id", "ct.source_commit_id")
    .innerJoin("resumes as r", "r.id", "rc.resume_id")
    .select(["ct.id", "ct.source_commit_id", "r.employee_id"])
    .where("ct.id", "=", input.id)
    .executeTakeFirst();

  if (!tag) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && tag.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  await db
    .deleteFrom("commit_tags")
    .where("id", "=", input.id)
    .executeTakeFirst();

  return { success: true };
}

export const deleteCommitTagHandler = implement(contract.deleteCommitTag).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return deleteCommitTag(getDb(), user, input);
  }
);

export function createDeleteCommitTagHandler(db: Kysely<Database>) {
  return implement(contract.deleteCommitTag).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return deleteCommitTag(db, user, input);
    }
  );
}
