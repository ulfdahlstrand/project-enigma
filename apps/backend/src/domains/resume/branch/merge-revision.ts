import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { mergeRevisionIntoSourceInputSchema, mergeRevisionIntoSourceOutputSchema } from "@cv-tool/contracts";

type MergeRevisionIntoSourceInput = z.infer<typeof mergeRevisionIntoSourceInputSchema>;
type MergeRevisionIntoSourceOutput = z.infer<typeof mergeRevisionIntoSourceOutputSchema>;

export async function mergeRevisionIntoSource(
  db: Kysely<Database>,
  user: AuthUser,
  input: MergeRevisionIntoSourceInput,
): Promise<MergeRevisionIntoSourceOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const revision = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select([
      "rb.id",
      "rb.resume_id",
      "rb.branch_type",
      "rb.source_branch_id",
      "rb.source_commit_id",
      "rb.head_commit_id",
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
      message: "Only revision branches can be merged",
    });
  }

  if (revision.source_branch_id === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Revision branch has no source branch",
    });
  }

  // Fetch current source variant state to check fast-forward eligibility.
  const source = await db
    .selectFrom("resume_branches")
    .selectAll()
    .where("id", "=", revision.source_branch_id)
    .executeTakeFirst();

  if (source === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Source variant branch not found" });
  }

  // Block merge if source has advanced past the revision's fork point.
  // The user must rebase (create new commits on the revision that incorporate
  // the source's changes) before merging. See design doc §9 open question 1.
  if (source.head_commit_id !== revision.source_commit_id) {
    throw new ORPCError("CONFLICT", {
      message:
        "Source branch has advanced since this revision was created. " +
        "Please bring the revision up to date before merging.",
    });
  }

  // Fast-forward: advance source variant's HEAD to the revision's HEAD.
  await db
    .updateTable("resume_branches")
    .set({ head_commit_id: revision.head_commit_id })
    .where("id", "=", revision.source_branch_id)
    .execute();

  // Delete the revision branch (hard delete; soft delete can be added later).
  await db
    .deleteFrom("resume_branches")
    .where("id", "=", input.branchId)
    .execute();

  return { mergedIntoBranchId: revision.source_branch_id };
}

export const mergeRevisionIntoSourceHandler = implement(contract.mergeRevisionIntoSource).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return mergeRevisionIntoSource(getDb(), user, input);
  },
);

export function createMergeRevisionIntoSourceHandler(db: Kysely<Database>) {
  return implement(contract.mergeRevisionIntoSource).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return mergeRevisionIntoSource(db, user, input);
    },
  );
}
