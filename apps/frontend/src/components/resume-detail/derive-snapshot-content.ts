import type { AssignmentRow as EditorAssignmentRow } from "../AssignmentEditor";

const COVER_HIGHLIGHT_COUNT = 5;

type SnapshotContent = {
  title?: string | null;
  language?: string | null;
  consultantTitle?: string | null;
  presentation?: string[];
  summary?: string | null;
  highlightedItems?: string[] | null;
  skills: Array<{
    name: string;
    category?: string | null;
    sortOrder?: number;
  }>;
  skillGroups: Array<{
    name: string;
    sortOrder: number;
  }>;
  assignments: Array<{
    assignmentId: string;
    isCurrent: boolean;
    startDate: string | Date;
    clientName: string;
    role: string;
    description: string;
    endDate: string | Date | null;
    technologies: string[];
    keywords?: string | null;
  }>;
  education: Array<{
    type: "degree" | "certification" | "language";
    value: string;
    sortOrder: number;
  }>;
} | null | undefined;

type EducationEntry = {
  id: string;
  employeeId: string;
  type: "degree" | "certification" | "language";
  value: string;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ResolvedAssignment = {
  id: string;
  assignmentId?: string;
  isCurrent: boolean;
  startDate: string | Date;
  clientName: string;
  role: string;
  description: string;
  endDate: string | Date | null;
  technologies: string[];
  keywords?: string | null;
};

type BranchAssignmentInput = {
  assignmentId: string;
  isCurrent: boolean;
  startDate: string | Date;
  clientName: string;
  role: string;
  description: string;
  endDate: string | Date | null;
  technologies: string[];
  keywords?: string | null;
};

type SkillGroupEntry = {
  id: string;
  resumeId: string;
  name: string;
  sortOrder: number;
};

type SkillEntry = {
  id: string;
  groupId: string;
  name: string;
  category: string | null;
  sortOrder: number;
};

export interface ResolvedResumeContent {
  resolvedEducation: EducationEntry[];
  assignments: ResolvedAssignment[];
  resumeTitle: string;
  language: string | null | undefined;
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  snapshotSkillGroups: SkillGroupEntry[] | null;
  snapshotSkills: SkillEntry[] | null;
}

interface DeriveInput {
  resumeId: string;
  employeeId: string;
  snapshotContent: SnapshotContent;
  isSnapshotMode: boolean;
  shouldReadBranchState: boolean;
  branchResume: {
    education?: Array<{
      type: "degree" | "certification" | "language";
      value: string;
      sortOrder: number;
    }>;
    assignments?: BranchAssignmentInput[];
    title?: string | null;
    language?: string | null;
    consultantTitle?: string | null;
    presentation?: string[];
    summary?: string | null;
    highlightedItems?: string[] | null;
  } | null | undefined;
  liveBranchAssignments: ResolvedAssignment[];
  fullEducation: EducationEntry[];
  activeBranchLanguage: string | null | undefined;
  sortedAssignmentsForFallback: ResolvedAssignment[];
}

/**
 * Pure derivation of the resume content surface the detail page renders.
 *
 * Resolves which source of truth to use for each field (snapshot commit,
 * branch-backed state, or live resume), builds synthetic skill groups for
 * snapshots, and produces fallback highlighted items from assignments.
 */
export function resolveResumeContent(input: DeriveInput): ResolvedResumeContent {
  const {
    resumeId,
    employeeId,
    snapshotContent,
    isSnapshotMode,
    shouldReadBranchState,
    branchResume,
    liveBranchAssignments,
    fullEducation,
    activeBranchLanguage,
    sortedAssignmentsForFallback,
  } = input;

  const branchEducation = !isSnapshotMode && shouldReadBranchState
    ? branchResume?.education ?? []
    : [];
  const effectiveEducation = snapshotContent?.education ?? branchEducation;
  const resolvedEducation: EducationEntry[] = effectiveEducation.length > 0
    ? effectiveEducation.map((entry, index) => ({
        id: `snapshot-education-${index}`,
        employeeId,
        type: entry.type,
        value: entry.value,
        sortOrder: entry.sortOrder,
        createdAt: "",
        updatedAt: "",
      }))
    : fullEducation;

  const assignments: ResolvedAssignment[] = isSnapshotMode
    ? (snapshotContent?.assignments ?? []).map((assignment) => ({
        ...assignment,
        id: assignment.assignmentId,
      }))
    : (shouldReadBranchState
        ? (branchResume?.assignments ?? []).map((assignment) => ({
            ...assignment,
            id: assignment.assignmentId,
          }))
        : liveBranchAssignments);

  const resumeTitle = snapshotContent?.title ?? branchResume?.title ?? "";
  const language = snapshotContent?.language ?? activeBranchLanguage ?? branchResume?.language;
  const consultantTitle = snapshotContent?.consultantTitle ?? branchResume?.consultantTitle ?? null;
  const presentation = snapshotContent?.presentation ?? branchResume?.presentation ?? [];
  const summary = snapshotContent?.summary ?? branchResume?.summary ?? null;

  const fallbackHighlightedItems = sortedAssignmentsForFallback
    .slice(0, COVER_HIGHLIGHT_COUNT)
    .map((assignment) => `${assignment.role} hos ${assignment.clientName}`);
  const highlightedItems =
    snapshotContent?.highlightedItems ??
    (branchResume?.highlightedItems && branchResume.highlightedItems.length > 0
      ? branchResume.highlightedItems
      : fallbackHighlightedItems);

  const { snapshotSkillGroups, snapshotSkills } = buildSnapshotSkillData(
    snapshotContent,
    resumeId,
  );

  return {
    resolvedEducation,
    assignments,
    resumeTitle,
    language,
    consultantTitle,
    presentation,
    summary,
    highlightedItems,
    snapshotSkillGroups,
    snapshotSkills,
  };
}

function buildSnapshotSkillData(
  snapshotContent: SnapshotContent,
  resumeId: string,
): {
  snapshotSkillGroups: SkillGroupEntry[] | null;
  snapshotSkills: SkillEntry[] | null;
} {
  if (!snapshotContent) {
    return { snapshotSkillGroups: null, snapshotSkills: null };
  }

  const explicitGroups = snapshotContent.skillGroups.map((group, index) => ({
    key: group.name.trim() || `__other__${index}`,
    name: group.name.trim(),
    sortOrder: group.sortOrder,
  }));
  const seen = new Set(explicitGroups.map((group) => group.key));
  const fallbackGroups = snapshotContent.skills.reduce<Array<{ key: string; name: string; sortOrder: number }>>(
    (acc, skill, index) => {
      const name = skill.category?.trim() || "";
      const key = name || "__other__";
      if (seen.has(key)) {
        return acc;
      }
      seen.add(key);
      return [...acc, {
        key,
        name,
        sortOrder: explicitGroups.length + index,
      }];
    },
    [],
  );

  const snapshotSkillGroupDefs = [...explicitGroups, ...fallbackGroups];

  const snapshotSkillGroups: SkillGroupEntry[] = snapshotSkillGroupDefs.map((group) => ({
    id: `snapshot-group-${group.key}`,
    resumeId,
    name: group.name,
    sortOrder: group.sortOrder,
  }));

  const snapshotGroupIdByName = new Map(
    snapshotSkillGroupDefs.map((group) => [group.name, `snapshot-group-${group.key}`]),
  );

  const snapshotSkills: SkillEntry[] = snapshotContent.skills.map((skill, index) => ({
    id: `snapshot-skill-${index}-${skill.name}`,
    groupId: snapshotGroupIdByName.get(skill.category?.trim() || "") ?? "snapshot-group-__other__",
    name: skill.name,
    category: skill.category ?? null,
    sortOrder: skill.sortOrder ?? index,
  }));

  return { snapshotSkillGroups, snapshotSkills };
}

export function buildEditableAssignments(
  sortedAssignments: ResolvedAssignment[],
): EditorAssignmentRow[] {
  return sortedAssignments.map((assignment) => ({
    ...assignment,
    assignmentId: assignment.assignmentId ?? assignment.id,
  })) as EditorAssignmentRow[];
}
