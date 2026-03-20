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
import type {
  listBranchAssignmentsFullInputSchema,
  listBranchAssignmentsFullOutputSchema,
} from "@cv-tool/contracts";

type ListBranchAssignmentsFullInput = z.infer<typeof listBranchAssignmentsFullInputSchema>;
type ListBranchAssignmentsFullOutput = z.infer<typeof listBranchAssignmentsFullOutputSchema>;

export async function listBranchAssignmentsFull(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListBranchAssignmentsFullInput
): Promise<ListBranchAssignmentsFullOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

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

  // All content now lives in branch_assignments; join assignments only for employee_id
  const rows = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("assignments as a", "a.id", "ba.assignment_id")
    .select([
      "ba.id",
      "ba.assignment_id",
      "ba.branch_id",
      "a.employee_id",
      "ba.client_name",
      "ba.role",
      "ba.description",
      "ba.start_date",
      "ba.end_date",
      "ba.technologies",
      "ba.is_current",
      "ba.keywords",
      "ba.type",
      "ba.highlight",
      "ba.sort_order",
      "ba.created_at",
      "ba.updated_at",
    ])
    .where("ba.branch_id", "=", input.branchId)
    .orderBy(sql`ba.sort_order ASC NULLS LAST`)
    .orderBy("ba.start_date", "desc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    branchId: row.branch_id,
    employeeId: row.employee_id,
    clientName: row.client_name,
    role: row.role,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    technologies: row.technologies,
    isCurrent: row.is_current,
    keywords: row.keywords,
    type: row.type,
    highlight: row.highlight,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export const listBranchAssignmentsFullHandler = implement(contract.listBranchAssignmentsFull).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listBranchAssignmentsFull(getDb(), user, input);
  }
);

export function createListBranchAssignmentsFullHandler(db: Kysely<Database>) {
  return implement(contract.listBranchAssignmentsFull).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listBranchAssignmentsFull(db, user, input);
    }
  );
}
