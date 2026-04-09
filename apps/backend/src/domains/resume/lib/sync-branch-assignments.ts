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
 * AI output may violate the schema in two ways:
 *   1. `assignmentId` is not a valid UUID (e.g. "1", "2"). Fix: insert an
 *      identity record into `assignments` and replace the fake ID.
 *   2. `startDate` is null/empty/invalid. Fix: fall back to today's date so
 *      the non-nullable DB column can be written.
 *
 * Returns a new content object (immutable). If nothing needs fixing the
 * original object is returned unchanged.
 */
export async function normaliseAssignmentIds(
  db: Kysely<Database>,
  employeeId: string,
  content: ResumeCommitContent
): Promise<ResumeCommitContent> {
  const needsNewId = content.assignments.filter((a) => !isUuid(a.assignmentId));
  const needsDateFix = content.assignments.filter(
    (a) => !isValidDateString(a.startDate)
  );

  if (needsNewId.length === 0 && needsDateFix.length === 0) return content;

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
      const newId = idMap.get(a.assignmentId);
      const needsDate = !isValidDateString(a.startDate);
      if (!newId && !needsDate) return a;
      return {
        ...a,
        ...(newId ? { assignmentId: newId } : {}),
        ...(needsDate ? { startDate: today } : {}),
      };
    }),
  };
}

/**
 * Legacy no-op kept temporarily so older tests/imports still resolve while the
 * application finishes moving away from the `branch_assignments` table.
 */
export async function syncBranchAssignmentsFromContent(
  _db: Kysely<Database>,
  _branchId: string,
  _content: ResumeCommitContent
): Promise<void> {
  return;
}
