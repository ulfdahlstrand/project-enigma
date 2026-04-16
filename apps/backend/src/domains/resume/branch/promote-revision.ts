import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { promoteRevisionToVariantInputSchema, promoteRevisionToVariantOutputSchema } from "@cv-tool/contracts";

type PromoteRevisionToVariantInput = z.infer<typeof promoteRevisionToVariantInputSchema>;
type PromoteRevisionToVariantOutput = z.infer<typeof promoteRevisionToVariantOutputSchema>;

export async function promoteRevisionToVariant(
  db: Kysely<Database>,
  user: AuthUser,
  input: PromoteRevisionToVariantInput,
): Promise<PromoteRevisionToVariantOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const revision = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.branch_type",
      "r.employee_id",
    ])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (revision === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && revision.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  if (revision.branch_type !== "revision") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only revision branches can be promoted to variants",
    });
  }

  // Flip branch_type to 'variant' and clear source fields.
  // forked_from_commit_id is retained — it records the historical divergence point.
  const promoted = await db
    .updateTable("resume_branches")
    .set({
      branch_type: "variant",
      source_branch_id: null,
      source_commit_id: null,
      name: input.name,
    })
    .where("id", "=", input.branchId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: promoted.id,
    resumeId: promoted.resume_id,
    name: promoted.name,
    language: promoted.language,
    isMain: promoted.is_main,
    headCommitId: promoted.head_commit_id,
    forkedFromCommitId: promoted.forked_from_commit_id,
    createdBy: promoted.created_by,
    createdAt: promoted.created_at,
    branchType: promoted.branch_type,
    sourceBranchId: promoted.source_branch_id,
    sourceCommitId: promoted.source_commit_id,
    isStale: false,
    isArchived: promoted.is_archived,
  };
}

export const promoteRevisionToVariantHandler = implement(contract.promoteRevisionToVariant).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return promoteRevisionToVariant(getDb(), user, input);
  },
);

export function createPromoteRevisionToVariantHandler(db: Kysely<Database>) {
  return implement(contract.promoteRevisionToVariant).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return promoteRevisionToVariant(db, user, input);
    },
  );
}
