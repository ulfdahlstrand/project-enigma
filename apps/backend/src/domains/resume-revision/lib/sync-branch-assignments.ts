import type { Kysely } from "kysely";
import type { Database, ResumeCommitContent } from "../../../db/types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function isValidDateString(s: unknown): s is string {
  if (!s || typeof s !== "string") return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/**
 * Normalises AI-generated assignment content so it can be safely persisted.
 *
 * AI output may violate the schema in several ways:
 *   1. `assignmentId` is not a valid UUID (e.g. "1", "2"). Fix: insert an
 *      identity record into `assignments` and replace the fake ID.
 *   2. `startDate` is null/empty/invalid. Fix: fall back to today's date.
 *   3. `endDate` is a word like "Present" instead of a date or null. Fix: set
 *      to null and mark `isCurrent: true`.
 *   4. `isCurrent` is missing entirely. Fix: infer from endDate nullability.
 *
 * Returns a new content object (immutable). If nothing needs fixing the
 * original object is returned unchanged.
 */
export async function normaliseAssignmentIds(
  db: Kysely<Database>,
  employeeId: string,
  content: ResumeCommitContent
): Promise<ResumeCommitContent> {
  const raw = content.assignments as Array<Record<string, unknown>>;

  const needsNewId = content.assignments.filter((a) => !isUuid(a.assignmentId));
  const needsFix = raw.some(
    (a) =>
      !isUuid(String(a["assignmentId"] ?? "")) ||
      !isValidDateString(a["startDate"]) ||
      (typeof a["endDate"] === "string" && !isValidDateString(a["endDate"]) && a["endDate"] !== null) ||
      !("isCurrent" in a)
  );

  if (needsNewId.length === 0 && !needsFix) return content;

  const idMap = new Map<string, string>();
  for (const a of needsNewId) {
    const identity = await db
      .insertInto("assignments")
      .values({ employee_id: employeeId })
      .returning("id")
      .executeTakeFirstOrThrow();
    idMap.set(a.assignmentId, identity.id);
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    ...content,
    assignments: content.assignments.map((a) => {
      const raw = a as unknown as Record<string, unknown>;
      const newId = idMap.get(a.assignmentId);
      const fixedStartDate = !isValidDateString(a.startDate) ? today : a.startDate;
      // "Present" or any non-date string in endDate → null + isCurrent true
      const endDateIsPresent =
        typeof a.endDate === "string" && !isValidDateString(a.endDate);
      const fixedEndDate = endDateIsPresent ? null : a.endDate;
      const fixedIsCurrent =
        "isCurrent" in raw
          ? a.isCurrent
          : endDateIsPresent || a.endDate === null;

      const unchanged =
        !newId &&
        fixedStartDate === a.startDate &&
        fixedEndDate === a.endDate &&
        fixedIsCurrent === a.isCurrent;

      if (unchanged) return a;

      return {
        ...a,
        ...(newId ? { assignmentId: newId } : {}),
        startDate: fixedStartDate,
        endDate: fixedEndDate,
        isCurrent: fixedIsCurrent,
      };
    }),
  };
}

/**
 * Syncs the branch_assignments table from a commit's JSONB content.
 * Upserts all assignments in the content into branch_assignments for the
 * given branch, preserving the branch_id + assignment_id uniqueness constraint.
 *
 * Call this after any operation that advances a branch's HEAD commit and
 * should be reflected in the live branch_assignments view.
 */
export async function syncBranchAssignmentsFromContent(
  db: Kysely<Database>,
  branchId: string,
  content: ResumeCommitContent
): Promise<void> {
  if (content.assignments.length === 0) return;

  await db
    .insertInto("branch_assignments")
    .values(
      content.assignments.map((a) => ({
        branch_id: branchId,
        assignment_id: a.assignmentId,
        client_name: a.clientName,
        role: a.role,
        description: a.description,
        start_date: isValidDateString(a.startDate)
          ? new Date(a.startDate)
          : new Date(),
        end_date: isValidDateString(a.endDate) ? new Date(a.endDate!) : null,
        technologies: a.technologies,
        is_current: a.isCurrent,
        keywords: a.keywords ?? null,
        type: a.type ?? null,
        highlight: a.highlight,
        sort_order: a.sortOrder ?? null,
      }))
    )
    .onConflict((oc) =>
      oc.columns(["branch_id", "assignment_id"]).doUpdateSet((eb) => ({
        client_name: eb.ref("excluded.client_name"),
        role: eb.ref("excluded.role"),
        description: eb.ref("excluded.description"),
        start_date: eb.ref("excluded.start_date"),
        end_date: eb.ref("excluded.end_date"),
        technologies: eb.ref("excluded.technologies"),
        is_current: eb.ref("excluded.is_current"),
        keywords: eb.ref("excluded.keywords"),
        type: eb.ref("excluded.type"),
        highlight: eb.ref("excluded.highlight"),
        sort_order: eb.ref("excluded.sort_order"),
        updated_at: new Date(),
      }))
    )
    .execute();
}
