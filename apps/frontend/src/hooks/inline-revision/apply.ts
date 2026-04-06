import type { QueryClient } from "@tanstack/react-query";
import type { ResumeAssignmentLike } from "./types";
import {
  formatSkillsSnapshot,
  groupSkillsByCategory,
  hydrateSkillsSuggestion,
  isSkillsSection,
  normalizeSkillCategory,
  resequenceSkillGroups,
} from "./skills";
import type { RevisionSuggestions } from "../../lib/ai-tools/registries/resume-tool-schemas";

type Suggestion = RevisionSuggestions["suggestions"][number];

type DraftDependencies = {
  consultantTitle: string | null;
  presentation: string[];
  summary: string | null;
  highlightedItems: string[];
  skills: Array<{ groupId?: string; name: string; category: string | null; sortOrder: number }>;
  sortedAssignments: ResumeAssignmentLike[];
};

type DraftStateDependencies = {
  titleRef: { current: string };
  presentationRef: { current: string };
  summaryRef: { current: string };
  setTitle: (value: string) => void;
  setPresentation: (value: string) => void;
  setSummary: (value: string) => void;
};

export function getSuggestionOriginalText(
  suggestion: Suggestion,
  deps: DraftDependencies,
) {
  const hydratedSuggestion = hydrateSkillsSuggestion(suggestion, deps.skills);
  const section = hydratedSuggestion.section.trim().toLowerCase();

  if (suggestion.assignmentId) {
    const matchingAssignment = deps.sortedAssignments.find((assignment) => {
      const assignmentIdentityId = assignment.assignmentId ?? assignment.id;
      return assignmentIdentityId === suggestion.assignmentId;
    });

    if (matchingAssignment?.description) {
      return matchingAssignment.description;
    }
  }

  if (section.includes("title") || section.includes("titel") || section.includes("consultant")) {
    return deps.consultantTitle ?? "";
  }

  if (section.includes("presentation") || section.includes("profil") || section.includes("intro")) {
    return deps.presentation.join("\n\n");
  }

  if (section.includes("summary") || section.includes("sammanfatt")) {
    return deps.summary ?? "";
  }

  if (isSkillsSection(section)) {
    if (hydratedSuggestion.skillScope?.type === "group_contents" && hydratedSuggestion.skillScope.category) {
      const targetCategory = normalizeSkillCategory(hydratedSuggestion.skillScope.category);
      const targetGroup = groupSkillsByCategory(deps.skills).find((group) => group.category === targetCategory);
      if (targetGroup) {
        return `${targetGroup.category}: ${targetGroup.skills.map((skill) => skill.name).join(", ")}`;
      }
    }

    return formatSkillsSnapshot(deps.skills);
  }

  if (section.includes("assignment") || section.includes("uppdrag") || section.includes("experience")) {
    const matchingAssignment = deps.sortedAssignments.find((assignment) => {
      const client = assignment.clientName.toLowerCase();
      const role = assignment.role.toLowerCase();
      return section.includes(client) || section.includes(role);
    });

    if (matchingAssignment?.description) {
      return matchingAssignment.description;
    }
  }

  return "";
}

export function applySuggestionTextToDraft(
  suggestion: Suggestion,
  draftState: DraftStateDependencies,
  buildDraftPatchFromValues: (title: string, presentation: string, summary: string) => unknown,
) {
  const section = suggestion.section.trim().toLowerCase();
  const suggestedText = suggestion.suggestedText.trim();
  let nextTitle = draftState.titleRef.current;
  let nextPresentation = draftState.presentationRef.current;
  let nextSummary = draftState.summaryRef.current;

  if (section.includes("title") || section.includes("titel") || section.includes("consultant")) {
    nextTitle = suggestedText;
  } else if (section.includes("presentation") || section.includes("profil") || section.includes("intro")) {
    nextPresentation = suggestedText;
  } else if (section.includes("summary") || section.includes("sammanfatt")) {
    nextSummary = suggestedText;
  } else {
    return null;
  }

  draftState.titleRef.current = nextTitle;
  draftState.presentationRef.current = nextPresentation;
  draftState.summaryRef.current = nextSummary;
  draftState.setTitle(nextTitle);
  draftState.setPresentation(nextPresentation);
  draftState.setSummary(nextSummary);
  return buildDraftPatchFromValues(nextTitle, nextPresentation, nextSummary);
}

export async function applySuggestionToAssignment(
  suggestion: Suggestion,
  deps: {
    activeBranchId: string | null;
    sortedAssignments: ResumeAssignmentLike[];
    queryClient: QueryClient;
    updateBranchAssignment: (input: { id: string; description: string }) => Promise<unknown>;
    saveVersion: (input: { branchId: string; title: string }) => Promise<unknown>;
    buildCommitMessage: (suggestion: Suggestion) => string;
  },
) {
  if (!suggestion.assignmentId || !deps.activeBranchId) {
    return false;
  }

  const targetAssignment = deps.sortedAssignments.find((assignment) => {
    const assignmentIdentityId = assignment.assignmentId ?? assignment.id;
    return assignmentIdentityId === suggestion.assignmentId;
  });

  if (!targetAssignment) {
    return false;
  }

  const branchAssignmentId = targetAssignment.id;
  const nextDescription = suggestion.suggestedText.trim();
  const assignmentsQueryKey = ["listBranchAssignmentsFull", deps.activeBranchId] as const;
  const previousAssignments = deps.queryClient.getQueryData<ResumeAssignmentLike[]>(assignmentsQueryKey);

  deps.queryClient.setQueryData<ResumeAssignmentLike[]>(assignmentsQueryKey, (prev) =>
    (prev ?? []).map((assignment) =>
      assignment.id === branchAssignmentId ? { ...assignment, description: nextDescription } : assignment,
    ),
  );

  try {
    await deps.updateBranchAssignment({
      id: branchAssignmentId,
      description: nextDescription,
    });
    await deps.saveVersion({
      branchId: deps.activeBranchId,
      title: deps.buildCommitMessage(suggestion),
    });
    return true;
  } catch (error) {
    deps.queryClient.setQueryData(assignmentsQueryKey, previousAssignments);
    throw error;
  }
}

export async function applySuggestionToSkills(
  suggestion: Suggestion,
  deps: {
    activeBranchId: string | null;
    skills: Array<{ groupId?: string; name: string; category: string | null; sortOrder: number }>;
    saveVersion: (input: {
      branchId: string;
      title: string;
      skills: Array<{ name: string; category: string | null; sortOrder: number }>;
    }) => Promise<unknown>;
    buildCommitMessage: (suggestion: Suggestion) => string;
  },
) {
  const hydratedSuggestion = hydrateSkillsSuggestion(suggestion, deps.skills);
  if (!deps.activeBranchId || !hydratedSuggestion.skills || hydratedSuggestion.skills.length === 0) {
    return false;
  }

  const currentSkillGroups = groupSkillsByCategory(deps.skills);
  let nextSkills = hydratedSuggestion.skills.map((skill) => {
    return {
      name: skill.name,
      category: skill.category,
      sortOrder: skill.sortOrder,
    };
  });

  if (hydratedSuggestion.skillScope?.type === "group_order") {
    const desiredCategoryOrder = hydratedSuggestion.skills.reduce<string[]>((acc, skill) => {
      const category = normalizeSkillCategory(skill.category);
      if (!acc.includes(category)) {
        acc.push(category);
      }
      return acc;
    }, []);
    const currentGroupsByCategory = new Map(
      currentSkillGroups.map((group) => [group.category, group]),
    );
    const reorderedGroups = desiredCategoryOrder
      .map((category) => currentGroupsByCategory.get(category))
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
    const remainingGroups = currentSkillGroups.filter((group) => !desiredCategoryOrder.includes(group.category));

    nextSkills = resequenceSkillGroups([...reorderedGroups, ...remainingGroups]);
  } else if (
    hydratedSuggestion.skillScope?.type === "group_contents"
    && hydratedSuggestion.skillScope.category
  ) {
    const targetCategory = normalizeSkillCategory(hydratedSuggestion.skillScope.category);
    const desiredNames = hydratedSuggestion.skills
      .filter((skill) => normalizeSkillCategory(skill.category) === targetCategory)
      .map((skill) => skill.name.trim().toLowerCase());
    const desiredNameSet = new Set(desiredNames);

    nextSkills = resequenceSkillGroups(currentSkillGroups.map((group) => {
      if (group.category !== targetCategory) {
        return group;
      }

      const skillsByName = new Map(
        group.skills.map((skill) => [skill.name.trim().toLowerCase(), skill]),
      );
      const reorderedSkills = desiredNames
        .map((name) => skillsByName.get(name))
        .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
      const remainingSkills = group.skills.filter((skill) => !desiredNameSet.has(skill.name.trim().toLowerCase()));

      return {
        ...group,
        skills: [...reorderedSkills, ...remainingSkills],
      };
    }));
  }

  await deps.saveVersion({
    branchId: deps.activeBranchId,
    title: deps.buildCommitMessage(hydratedSuggestion),
    skills: nextSkills,
  });

  return true;
}
