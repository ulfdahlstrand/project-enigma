import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../db/types.js";
import { getDb } from "../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../auth/require-auth.js";
import { resolveEmployeeId } from "../auth/resolve-employee-id.js";
import type { listAssignmentsInputSchema, listAssignmentsOutputSchema } from "@cv-tool/contracts";

type ListAssignmentsInput = z.infer<typeof listAssignmentsInputSchema>;
type ListAssignmentsOutput = z.infer<typeof listAssignmentsOutputSchema>;

function rowToAssignment(row: {
  id: string;
  employee_id: string;
  resume_id: string | null;
  client_name: string;
  role: string;
  description: string;
  start_date: Date;
  end_date: Date | null;
  technologies: string[];
  is_current: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    resumeId: row.resume_id,
    clientName: row.client_name,
    role: row.role,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    technologies: row.technologies,
    isCurrent: row.is_current,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { rowToAssignment };

export async function listAssignments(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListAssignmentsInput
): Promise<ListAssignmentsOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  let query = db.selectFrom("assignments").selectAll();

  if (ownerEmployeeId !== null) {
    query = query.where("employee_id", "=", ownerEmployeeId);
  } else {
    if (input.employeeId !== undefined) {
      query = query.where("employee_id", "=", input.employeeId);
    }
  }

  if (input.resumeId !== undefined) {
    query = query.where("resume_id", "=", input.resumeId);
  }

  const rows = await query
    .orderBy("is_current", "desc")
    .orderBy(sql`end_date DESC NULLS FIRST`)
    .orderBy("start_date", "desc")
    .orderBy("created_at", "desc")
    .execute();
  return rows.map(rowToAssignment);
}

export const listAssignmentsHandler = implement(contract.listAssignments).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listAssignments(getDb(), user, input);
  }
);

export function createListAssignmentsHandler(db: Kysely<Database>) {
  return implement(contract.listAssignments).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listAssignments(db, user, input);
    }
  );
}
