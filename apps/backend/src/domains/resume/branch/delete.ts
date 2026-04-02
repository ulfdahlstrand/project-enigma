import { implement, ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type {
  deleteResumeBranchInputSchema,
  deleteResumeBranchOutputSchema,
} from "@cv-tool/contracts";

type DeleteResumeBranchInput = z.infer<typeof deleteResumeBranchInputSchema>;
type DeleteResumeBranchOutput = z.infer<typeof deleteResumeBranchOutputSchema>;

export async function deleteResumeBranch(
  db: Kysely<Database>,
  user: AuthUser,
  input: DeleteResumeBranchInput,
): Promise<DeleteResumeBranchOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["rb.id", "rb.is_main", "r.employee_id"])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (!branch) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (branch.is_main) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Main branch cannot be deleted.",
    });
  }

  await db
    .deleteFrom("resume_branches")
    .where("id", "=", input.branchId)
    .execute();

  return { deleted: true };
}

export const deleteResumeBranchHandler = implement(contract.deleteResumeBranch).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return deleteResumeBranch(getDb(), user, input);
  },
);

export function createDeleteResumeBranchHandler(db: Kysely<Database>) {
  return implement(contract.deleteResumeBranch).handler(async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return deleteResumeBranch(db, user, input);
  });
}
