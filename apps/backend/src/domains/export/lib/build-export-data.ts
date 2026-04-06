import { ORPCError } from "@orpc/server";
import type { Kysely } from "kysely";
import { resumeCommitContentSchema } from "@cv-tool/contracts";
import { sortAssignments } from "@cv-tool/utils";
import type { Database } from "../../../db/types.js";
import type { AuthUser } from "../../../auth/require-auth.js";
import { resolveEmployeeId } from "../../../auth/resolve-employee-id.js";

// ---------------------------------------------------------------------------
// Shared export data shape
//
// All three export procedures (PDF, DOCX, Markdown) work on this struct.
// It is populated from either live tables (no commitId) or a commit snapshot.
// ---------------------------------------------------------------------------

export interface ExportData {
  resumeId: string;
  employeeId: string;
  name: string;
  email: string | null | undefined;
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
// Live-data path (existing behaviour)
// ---------------------------------------------------------------------------

async function buildFromLive(
  db: Kysely<Database>,
  resumeId: string,
  employeeId: string
): Promise<Omit<ExportData, "resumeId" | "employeeId" | "commitId">> {
  const resume = await db
    .selectFrom("resumes")
    .selectAll()
    .where("id", "=", resumeId)
    .executeTakeFirstOrThrow();

  const [employee, assignments, skills, education, highlightedItems] = await Promise.all([
    db
      .selectFrom("employees")
      .select(["id", "name", "email"])
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
      .selectFrom("resume_skills as rs")
      .innerJoin("resume_skill_groups as rsg", "rsg.id", "rs.group_id")
      .select(["rs.name", "rs.sort_order", "rsg.name as category", "rsg.sort_order as group_sort_order"])
      .where("rs.resume_id", "=", resumeId)
      .orderBy("rsg.sort_order", "asc")
      .orderBy("rs.sort_order", "asc")
      .execute(),
    db
      .selectFrom("education")
      .selectAll()
      .where("employee_id", "=", employeeId)
      .orderBy("sort_order", "asc")
      .execute(),
    db
      .selectFrom("resume_highlighted_items")
      .select(["text"])
      .where("resume_id", "=", resumeId)
      .orderBy("sort_order", "asc")
      .execute(),
  ]);

  return {
    name: employee?.name ?? "Unknown",
    email: employee?.email,
    consultantTitle: resume.consultant_title ?? "",
    language: resume.language ?? "en",
    presentation: (resume.presentation as string[] | null) ?? [],
    summary: resume.summary,
    highlightedItems: highlightedItems.map((item) => item.text),
    skills: skills.map((s) => ({
      name: s.name,
      category: s.category,
    })),
    assignments: sortAssignments(
      assignments.map((a) => ({
        role: a.role,
        client_name: a.client_name,
        start_date: typeof a.start_date === "string" ? a.start_date : a.start_date.toISOString(),
        end_date: a.end_date
          ? typeof a.end_date === "string"
            ? a.end_date
            : a.end_date.toISOString()
          : null,
        is_current: a.is_current,
        type: a.type,
        technologies: (a.technologies as string[]) ?? [],
        keywords: a.keywords,
        description: a.description ?? "",
      })),
      (a) => a.is_current,
      (a) => a.start_date
    ),
    education: education.map((e) => ({ type: e.type, value: e.value })),
  };
}

// ---------------------------------------------------------------------------
// Snapshot path (new behaviour when commitId is provided)
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
      .select(["id", "resume_id", "content"])
      .where("id", "=", commitId)
      .executeTakeFirst(),
    db
      .selectFrom("employees")
      .select(["id", "name", "email"])
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

  const content = resumeCommitContentSchema.parse(commitRow.content);

  return {
    name: employee?.name ?? "Unknown",
    email: employee?.email,
    consultantTitle: content.consultantTitle ?? "",
    language: content.language,
    presentation: content.presentation,
    summary: content.summary,
    highlightedItems: content.highlightedItems ?? [],
    skills: content.skills.map((s) => ({
      name: s.name,
      category: s.category,
    })),
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

/**
 * Resolves all data needed to render a resume export.
 *
 * When `commitId` is provided the content comes from the commit's JSONB
 * snapshot (education is still fetched live as it lives outside the snapshot).
 * When `commitId` is omitted the existing live-join path is used.
 *
 * Access control (ownership check) is performed here before any data is read.
 *
 * @throws ORPCError("NOT_FOUND")   if the resume (or commit) does not exist.
 * @throws ORPCError("FORBIDDEN")   if the caller doesn't own the resume.
 * @throws ORPCError("BAD_REQUEST") if the commit belongs to a different resume.
 */
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
