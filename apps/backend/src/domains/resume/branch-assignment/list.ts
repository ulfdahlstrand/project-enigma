import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { sql } from "kysely";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { listBranchAssignmentsInputSchema, listBranchAssignmentsOutputSchema } from "@cv-tool/contracts";

type ListBranchAssignmentsInput = z.infer<typeof listBranchAssignmentsInputSchema>;
type ListBranchAssignmentsOutput = z.infer<typeof listBranchAssignmentsOutputSchema>;

export async function listBranchAssignments(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListBranchAssignmentsInput
): Promise<ListBranchAssignmentsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  // Verify branch exists and check ownership
  const branch = await db
    .selectFrom("resume_branches as rb")
    .innerJoin("resumes as r", "r.id", "rb.resume_id")
    .select(["rb.id", "r.employee_id"])
    .where("rb.id", "=", input.branchId)
    .executeTakeFirst();

  if (branch === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && branch.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const rows = await db
    .selectFrom("branch_assignments")
    .selectAll()
    .where("branch_id", "=", input.branchId)
    .orderBy(sql`sort_order ASC NULLS LAST`)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    assignmentId: row.assignment_id,
    highlight: row.highlight,
    sortOrder: row.sort_order,
  }));
}

export const listBranchAssignmentsHandler = implement(contract.listBranchAssignments).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listBranchAssignments(getDb(), user, input);
  }
);

export function createListBranchAssignmentsHandler(db: Kysely<Database>) {
  return implement(contract.listBranchAssignments).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listBranchAssignments(db, user, input);
    }
  );
}
