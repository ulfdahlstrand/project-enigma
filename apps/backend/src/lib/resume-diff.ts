import type {
  ResumeCommitContent,
  ResumeDiff,
  ResumeDiffScalars,
  SkillDiffEntry,
  AssignmentDiffEntry,
} from "@cv-tool/contracts";

// ---------------------------------------------------------------------------
// Scalar diff helpers
// ---------------------------------------------------------------------------

/** Order-sensitive comparison (for `presentation` where order is meaningful). */
function diffArray(a: string[], b: string[]): boolean {
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/** Order-insensitive comparison (for `technologies` where order is arbitrary). */
function diffArrayUnordered(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  const sorted = (arr: string[]) => [...arr].sort();
  const sa = sorted(a);
  const sb = sorted(b);
  return sa.some((v, i) => v !== sb[i]);
}

function diffScalars(
  base: ResumeCommitContent,
  head: ResumeCommitContent
): ResumeDiffScalars {
  const scalars: ResumeDiffScalars = {};

  if (base.title !== head.title) {
    scalars.title = { before: base.title, after: head.title };
  }
  if (base.consultantTitle !== head.consultantTitle) {
    scalars.consultantTitle = {
      before: base.consultantTitle,
      after: head.consultantTitle,
    };
  }
  if (diffArray(base.presentation, head.presentation)) {
    scalars.presentation = {
      before: base.presentation,
      after: head.presentation,
    };
  }
  if (base.summary !== head.summary) {
    scalars.summary = { before: base.summary, after: head.summary };
  }
  if (base.language !== head.language) {
    scalars.language = { before: base.language, after: head.language };
  }

  return scalars;
}

// ---------------------------------------------------------------------------
// Skills diff
// ---------------------------------------------------------------------------

function diffSkills(
  base: ResumeCommitContent,
  head: ResumeCommitContent
): SkillDiffEntry[] {
  const baseMap = new Map(base.skills.map((s) => [s.name, s]));
  const headMap = new Map(head.skills.map((s) => [s.name, s]));
  const allNames = new Set([...baseMap.keys(), ...headMap.keys()]);

  const entries: SkillDiffEntry[] = [];

  for (const name of allNames) {
    const b = baseMap.get(name);
    const h = headMap.get(name);

    if (!b) {
      entries.push({ status: "added", name, after: h });
    } else if (!h) {
      entries.push({ status: "removed", name, before: b });
    } else {
      const changed =
        b.level !== h.level ||
        b.category !== h.category ||
        b.sortOrder !== h.sortOrder;
      entries.push(
        changed
          ? { status: "modified", name, before: b, after: h }
          : { status: "unchanged", name, before: b, after: h }
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Assignments diff
// ---------------------------------------------------------------------------

function diffAssignments(
  base: ResumeCommitContent,
  head: ResumeCommitContent
): AssignmentDiffEntry[] {
  const baseMap = new Map(base.assignments.map((a) => [a.assignmentId, a]));
  const headMap = new Map(head.assignments.map((a) => [a.assignmentId, a]));
  const allIds = new Set([...baseMap.keys(), ...headMap.keys()]);

  const entries: AssignmentDiffEntry[] = [];

  for (const assignmentId of allIds) {
    const b = baseMap.get(assignmentId);
    const h = headMap.get(assignmentId);

    if (!b) {
      entries.push({ status: "added", assignmentId, after: h });
    } else if (!h) {
      entries.push({ status: "removed", assignmentId, before: b });
    } else {
      const changed =
        b.clientName !== h.clientName ||
        b.role !== h.role ||
        b.description !== h.description ||
        b.startDate !== h.startDate ||
        b.endDate !== h.endDate ||
        b.isCurrent !== h.isCurrent ||
        b.keywords !== h.keywords ||
        b.type !== h.type ||
        b.highlight !== h.highlight ||
        b.sortOrder !== h.sortOrder ||
        diffArrayUnordered(b.technologies, h.technologies);
      entries.push(
        changed
          ? { status: "modified", assignmentId, before: b, after: h }
          : { status: "unchanged", assignmentId, before: b, after: h }
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produces a structural diff between two resume commit snapshots.
 * Pure function — no I/O, no side effects.
 */
export function diffResumeCommits(
  base: ResumeCommitContent,
  head: ResumeCommitContent
): ResumeDiff {
  const scalars = diffScalars(base, head);
  const skills = diffSkills(base, head);
  const assignments = diffAssignments(base, head);

  const hasChanges =
    Object.keys(scalars).length > 0 ||
    skills.some((s) => s.status !== "unchanged") ||
    assignments.some((a) => a.status !== "unchanged");

  return { scalars, skills, assignments, hasChanges };
}
