import { implement } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { contract } from "@cv-tool/contracts";
import type { z } from "zod";
import type { Kysely } from "kysely";
import { createHash } from "node:crypto";
import type { Database, ResumeCommitContent } from "../../../db/types.js";
import { getDb } from "../../../db/client.js";
import { requireAuth, type AuthUser, type AuthContext } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import type { getResumeOutputSchema } from "@cv-tool/contracts";
import { filterDeletedAssignments } from "../lib/branch-assignment-content.js";
import { readTreeContent } from "../lib/read-tree-content.js";

// ---------------------------------------------------------------------------
// getResume — query logic
// ---------------------------------------------------------------------------

type GetResumeOutput = z.infer<typeof getResumeOutputSchema>;

function buildDeterministicUuid(seed: string): string {
  const bytes = createHash("sha1").update(seed).digest().subarray(0, 16);

  // Force RFC 4122-compliant version/variant bits so zod uuid validation
  // accepts synthetic IDs used for detached snapshot reads.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildSnapshotSkills(resumeId: string, snapshotContent: ResumeCommitContent) {
  const skillGroups = snapshotContent.skillGroups.map((group, index) => ({
    id: buildDeterministicUuid(`${resumeId}:snapshot-skill-group:${index}:${group.name}`),
    resumeId,
    name: group.name,
    sortOrder: group.sortOrder,
  }));

  const groupIdByName = new Map(
    skillGroups.map((group) => [group.name.trim(), group.id]),
  );

  const skills = snapshotContent.skills.map((skill, index) => ({
    id: buildDeterministicUuid(`${resumeId}:snapshot-skill:${index}:${skill.name}:${skill.category ?? ""}`),
    resumeId,
    groupId:
      groupIdByName.get(skill.category?.trim() ?? "")
      ?? skillGroups[0]?.id
      ?? buildDeterministicUuid(`${resumeId}:snapshot-skill-ungrouped:${index}`),
    name: skill.name,
    category: skill.category ?? null,
    sortOrder: skill.sortOrder,
  }));

  return { skillGroups, skills };
}

/**
 * Fetches a single resume with its skills by ID.
 *
 * Access rules:
 *   - Admins can fetch any resume.
 *   - Consultants can only fetch resumes belonging to their employee record;
 *     throws FORBIDDEN if the resume belongs to a different employee.
 *
 * @param db   - Kysely instance (real or mock).
 * @param user - The authenticated user.
 * @param id   - UUID of the resume to retrieve.
 * @throws ORPCError("NOT_FOUND")  if the resume does not exist.
 * @throws ORPCError("FORBIDDEN")  if a consultant attempts to access another's resume.
 */
export async function getResume(
  db: Kysely<Database>,
  user: AuthUser,
  id: string,
  commitId?: string,
): Promise<GetResumeOutput> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resumeRow = await db
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
      "rb.forked_from_commit_id",
    ])
    .where("r.id", "=", id)
    .executeTakeFirst();

  if (resumeRow === undefined) {
    throw new ORPCError("NOT_FOUND");
  }

  if (ownerEmployeeId !== null && resumeRow.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  let snapshotContent: ResumeCommitContent | null = null;
  if (commitId) {
    // Commit-first read: when a commitId is given, resolve exclusively from
    // that exact commit. This is a detached view, so snapshot data must win.
    const commitRow = await db
      .selectFrom("resume_commits")
      .select(["id", "resume_id", "tree_id"])
      .where("id", "=", commitId)
      .executeTakeFirst();

    if (commitRow === undefined || commitRow.resume_id !== id) {
      throw new ORPCError("NOT_FOUND");
    }

    if (commitRow.tree_id) {
      snapshotContent = await readTreeContent(db, commitRow.tree_id);
    }
  } else if (resumeRow.head_commit_id) {
    const commitRow = await db
      .selectFrom("resume_commits")
      .select(["tree_id"])
      .where("id", "=", resumeRow.head_commit_id)
      .executeTakeFirst();
    if (commitRow?.tree_id) {
      snapshotContent = await readTreeContent(db, commitRow.tree_id);
    }
  }

  if (snapshotContent !== null) {
    const snapshotAssignments = await filterDeletedAssignments(db, snapshotContent.assignments ?? []);
    const snapshotSkills = buildSnapshotSkills(id, snapshotContent);

    return {
      id: resumeRow.id,
      employeeId: resumeRow.employee_id,
      title: snapshotContent.title ?? resumeRow.title,
      consultantTitle: snapshotContent.consultantTitle ?? null,
      presentation: snapshotContent.presentation ?? [],
      summary: snapshotContent.summary ?? null,
      highlightedItems: snapshotContent.highlightedItems ?? [],
      language: snapshotContent.language ?? resumeRow.language,
      isMain: resumeRow.is_main,
      mainBranchId: resumeRow.branch_id ?? null,
      headCommitId: resumeRow.head_commit_id ?? null,
      createdAt: resumeRow.created_at,
      updatedAt: resumeRow.updated_at,
      skillGroups: snapshotSkills.skillGroups,
      skills: snapshotSkills.skills,
      assignments: snapshotAssignments,
    };
  }

  // No tree-backed commit — return resume metadata with empty content arrays.
  return {
    id: resumeRow.id,
    employeeId: resumeRow.employee_id,
    title: resumeRow.title,
    consultantTitle: null,
    presentation: [],
    summary: null,
    highlightedItems: [],
    language: resumeRow.language,
    isMain: resumeRow.is_main,
    mainBranchId: resumeRow.branch_id ?? null,
    headCommitId: resumeRow.head_commit_id ?? null,
    createdAt: resumeRow.created_at,
    updatedAt: resumeRow.updated_at,
    skillGroups: [],
    skills: [],
    assignments: [],
  };
}

// ---------------------------------------------------------------------------
// oRPC procedure handler — production handler using the default db singleton
// ---------------------------------------------------------------------------

export const getResumeHandler = implement(contract.getResume).handler(
  async ({ input, context }) => {
    const user = requireAuth(context as AuthContext);
    return getResume(getDb(), user, input.id, input.commitId);
  }
);

// ---------------------------------------------------------------------------
// Factory variant — used in tests to inject a mock db instance
// ---------------------------------------------------------------------------

/**
 * Creates a `getResume` oRPC handler backed by the given Kysely instance.
 * Intended for use in unit tests via dependency injection.
 *
 * @param db - Kysely instance to inject (real or mock).
 */
export function createGetResumeHandler(db: Kysely<Database>) {
  return implement(contract.getResume).handler(
    async ({ input, context }) => {
      const user = requireAuth(context as AuthContext);
      return getResume(db, user, input.id, input.commitId);
    }
  );
}
