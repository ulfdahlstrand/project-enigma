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

  const rows = await db
    .selectFrom("branch_assignments as ba")
    .innerJoin("assignments as a", "a.id", "ba.assignment_id")
    .select([
      "a.id",
      "a.employee_id",
      "a.client_name",
      "a.role",
      "a.description",
      "a.start_date",
      "a.end_date",
      "a.technologies",
      "a.is_current",
      "a.keywords",
      "a.type",
      "a.highlight",
      "a.created_at",
      "a.updated_at",
      "ba.sort_order",
    ])
    .where("ba.branch_id", "=", input.branchId)
    .orderBy(sql`ba.sort_order ASC NULLS LAST`)
    .orderBy("a.start_date", "desc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
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
