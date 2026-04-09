import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { sortAssignments } from "@cv-tool/utils";
import type { Database } from "../../../db/types.js";
import type { AuthUser } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";
import { readTreeContent } from "../../resume/lib/read-tree-content.js";

// ---------------------------------------------------------------------------
// Shared export data shape
//
// All three export procedures (PDF, DOCX, Markdown) work on this struct.
// ---------------------------------------------------------------------------

export interface ExportData {
  resumeId: string;
  employeeId: string;
  name: string;
  email: string | null | undefined;
  profileImageDataUrl: string | null;
  consultantTitle: string;
  language: string;
  presentation: string[];
  summary: string | null | undefined;
  highlightedItems: string[];
  skills: Array<{ name: string; category: string | null }>;
  assignments: Array<{
    role: string;
    client_name: string;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    type: string | null;
    technologies: string[];
    keywords: string | null;
    description: string;
  }>;
  education: Array<{ type: string; value: string }>;
  /** Commit ID if this export was built from a snapshot; null for live data. */
  commitId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapAssignments(
  assignments: Array<{
    role: string;
    client_name: string;
    start_date: string | Date;
    end_date: string | Date | null;
    is_current: boolean;
    type: string | null;
    technologies: unknown;
    keywords: string | null;
    description: string | null;
  }>
) {
  return sortAssignments(
    assignments.map((a) => ({
      role: a.role,
      client_name: a.client_name,
      start_date: typeof a.start_date === "string" ? a.start_date : a.start_date.toISOString(),
      end_date: a.end_date
        ? typeof a.end_date === "string" ? a.end_date : a.end_date.toISOString()
        : null,
      is_current: a.is_current,
      type: a.type,
      technologies: (a.technologies as string[]) ?? [],
      keywords: a.keywords,
      description: a.description ?? "",
    })),
    (a) => a.is_current,
    (a) => a.start_date
  );
}

// ---------------------------------------------------------------------------
// Live-data path (no commitId supplied — uses main branch HEAD commit tree)
// ---------------------------------------------------------------------------

async function buildFromLive(
  db: Kysely<Database>,
  resumeId: string,
  employeeId: string
): Promise<Omit<ExportData, "resumeId" | "employeeId" | "commitId">> {
  const resume = await db
    .selectFrom("resumes as r")
    .leftJoin("resume_branches as rb", (join) =>
      join.onRef("rb.resume_id", "=", "r.id").on("rb.is_main", "=", true)
    )
    .select([
      "r.language",
      "rb.head_commit_id",
      "rb.forked_from_commit_id",
    ])
    .where("r.id", "=", resumeId)
    .executeTakeFirstOrThrow();

  const snapshotCommitId = resume.head_commit_id ?? resume.forked_from_commit_id ?? null;

  const [employee, assignments, education, commitRow] = await Promise.all([
    db
      .selectFrom("employees")
      .select(["name", "email", "profile_image_data_url"])
      .where("id", "=", employeeId)
      .executeTakeFirst(),
    db
      .selectFrom("branch_assignments as ba")
      .innerJoin("resume_branches as rb", "rb.id", "ba.branch_id")
      .innerJoin("assignments as a", "a.id", "ba.assignment_id")
      .selectAll("ba")
      .where("rb.resume_id", "=", resumeId)
      .where("rb.is_main", "=", true)
      .where("a.deleted_at", "is", null)
      .orderBy("ba.is_current", "desc")
      .orderBy("ba.start_date", "desc")
      .execute(),
    db
      .selectFrom("education")
      .selectAll()
      .where("employee_id", "=", employeeId)
      .orderBy("sort_order", "asc")
      .execute(),
    snapshotCommitId
      ? db
          .selectFrom("resume_commits")
          .select(["tree_id"])
          .where("id", "=", snapshotCommitId)
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  const content = commitRow?.tree_id
    ? await readTreeContent(db, commitRow.tree_id)
    : null;

  return {
    name: employee?.name ?? "Unknown",
    email: employee?.email,
    profileImageDataUrl: employee?.profile_image_data_url ?? null,
    consultantTitle: content?.consultantTitle ?? "",
    language: resume.language ?? "en",
    presentation: content?.presentation ?? [],
    summary: content?.summary ?? null,
    highlightedItems: content?.highlightedItems ?? [],
    skills: (content?.skills ?? []).map((s) => ({ name: s.name, category: s.category })),
    assignments: mapAssignments(assignments),
    education: education.map((e) => ({ type: e.type, value: e.value })),
  };
}

// ---------------------------------------------------------------------------
// Snapshot path (commitId supplied — reads directly from commit tree)
// ---------------------------------------------------------------------------

async function buildFromSnapshot(
  db: Kysely<Database>,
  resumeId: string,
  employeeId: string,
  commitId: string
): Promise<Omit<ExportData, "resumeId" | "employeeId" | "commitId">> {
  const [commitRow, employee, education] = await Promise.all([
    db
      .selectFrom("resume_commits")
      .select(["resume_id", "tree_id"])
      .where("id", "=", commitId)
      .executeTakeFirst(),
    db
      .selectFrom("employees")
      .select(["name", "email", "profile_image_data_url"])
      .where("id", "=", employeeId)
      .executeTakeFirst(),
    db
      .selectFrom("education")
      .selectAll()
      .where("employee_id", "=", employeeId)
      .orderBy("sort_order", "asc")
      .execute(),
  ]);

  if (!commitRow) {
    throw new ORPCError("NOT_FOUND", { message: "Commit not found" });
  }
  if (commitRow.resume_id !== resumeId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Commit does not belong to the specified resume",
    });
  }
  if (!commitRow.tree_id) {
    throw new ORPCError("BAD_REQUEST", { message: "Commit uses a legacy format without a tree" });
  }

  const content = await readTreeContent(db, commitRow.tree_id);

  return {
    name: employee?.name ?? "Unknown",
    email: employee?.email,
    profileImageDataUrl: employee?.profile_image_data_url ?? null,
    consultantTitle: content.consultantTitle ?? "",
    language: content.language,
    presentation: content.presentation,
    summary: content.summary,
    highlightedItems: content.highlightedItems ?? [],
    skills: content.skills.map((s) => ({ name: s.name, category: s.category })),
    assignments: sortAssignments(
      content.assignments.map((a) => ({
        role: a.role,
        client_name: a.clientName,
        start_date: a.startDate,
        end_date: a.endDate,
        is_current: a.isCurrent,
        type: a.type,
        technologies: a.technologies,
        keywords: a.keywords,
        description: a.description,
      })),
      (a) => a.is_current,
      (a) => a.start_date
    ),
    education: education.map((e) => ({ type: e.type, value: e.value })),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function buildExportData(
  db: Kysely<Database>,
  user: AuthUser,
  resumeId: string,
  commitId: string | null | undefined
): Promise<ExportData> {
  const ownerEmployeeId = await resolveEmployeeId(db, user);

  const resume = await db
    .selectFrom("resumes")
    .select(["id", "employee_id"])
    .where("id", "=", resumeId)
    .executeTakeFirst();

  if (!resume) {
    throw new ORPCError("NOT_FOUND");
  }
  if (ownerEmployeeId !== null && resume.employee_id !== ownerEmployeeId) {
    throw new ORPCError("FORBIDDEN");
  }

  const rest = commitId
    ? await buildFromSnapshot(db, resumeId, resume.employee_id, commitId)
    : await buildFromLive(db, resumeId, resume.employee_id);

  return {
    resumeId,
    employeeId: resume.employee_id,
    commitId: commitId ?? null,
    ...rest,
  };
}
