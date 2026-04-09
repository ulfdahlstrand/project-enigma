import { implement } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readTreeContent } from "../lib/read-tree-content.js";
import type { listResumesInputSchema, listResumesOutputSchema } from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// listResumes — query logic
//
// The query logic is extracted into a plain async function so it can be unit
// tested with a mock Kysely instance without relying on oRPC internals.
// ---------------------------------------------------------------------------

type ListResumesInput = z.infer<typeof listResumesInputSchema>;
type ListResumesOutput = z.infer<typeof listResumesOutputSchema>;

/**
 * Queries resumes from the database with optional filters.
 *
 * Access rules:
 *   - Admins can see all resumes and may optionally filter by employeeId or language.
 *   - Consultants only see resumes belonging to their own employee record;
 *     any employeeId filter in the input is ignored for ownership purposes.
 *
 * @param db    - Kysely instance (real or mock).
 * @param user  - The authenticated user.
 * @param input - Optional filter parameters (employeeId, language).
 */
export async function listResumes(
  db: Kysely<Database>,
  user: AuthUser,
  input: ListResumesInput
): Promise<ListResumesOutput> {
  // Determine ownership constraint
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  let query = db
    .selectFrom("resumes as r")
    .leftJoin("resume_branches as rb", (join) =>
      join.onRef("rb.resume_id", "=", "r.id").on("rb.is_main", "=", true)
    )
    .select([
      "r.id",
      "r.employee_id",
      "r.title",
      "r.language",
      "r.is_main",
      "r.created_at",
      "r.updated_at",
      "rb.id as branch_id",
      "rb.head_commit_id",
    ]);

  if (ownerEmployeeId !== null) {
    // Consultant: scope to their own employee, but still allow language filter
    query = query.where("r.employee_id", "=", ownerEmployeeId);
    if (input.language !== undefined) {
      query = query.where("r.language", "=", input.language);
    }
  } else {
    // Admin: apply optional filters from input
    if (input.employeeId !== undefined) {
      query = query.where("r.employee_id", "=", input.employeeId);
    }
    if (input.language !== undefined) {
      query = query.where("r.language", "=", input.language);
    }
  }

  const rows = await query.execute();
  const headCommitIds = [...new Set(rows.map((row) => row.head_commit_id).filter((id): id is string => id !== null))];
  const commitRows = headCommitIds.length > 0
    ? await db
        .selectFrom("resume_commits")
        .select(["id", "tree_id"])
        .where("id", "in", headCommitIds)
        .execute()
    : [];

  const contentByCommitId = new Map<string, ResumeCommitContent>();
  await Promise.all(
    commitRows
      .filter((row) => row.tree_id !== null)
      .map(async (row) => {
        const content = await readTreeContent(db, row.tree_id!);
        contentByCommitId.set(row.id, content);
      }),
  );

  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    consultantTitle: row.head_commit_id ? (contentByCommitId.get(row.head_commit_id)?.consultantTitle ?? null) : null,
    presentation: row.head_commit_id ? (contentByCommitId.get(row.head_commit_id)?.presentation ?? []) : [],
    summary: row.head_commit_id ? (contentByCommitId.get(row.head_commit_id)?.summary ?? null) : null,
    highlightedItems: [],
    language: row.language,
    isMain: row.is_main,
    mainBranchId: row.branch_id ?? null,
    headCommitId: row.head_commit_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const listResumesHandler = implement(contract.listResumes).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return listResumes(getDb(), user, input);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `listResumes` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createListResumesHandler(db: Kysely<Database>) {
  return implement(contract.listResumes).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return listResumes(db, user, input);
    }
  );
}
